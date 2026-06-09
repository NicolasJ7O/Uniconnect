import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../errors/app-error.js';

export async function getForumQuestions(subjectId: string) {
  const questions = await prisma.forumQuestion.findMany({
    where: { subjectId },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
        },
      },
      answers: {
        select: {
          createdAt: true,
        },
      },
    },
  });

  // Reordenamiento dinámico priorizando puntuación, antigüedad y actividad reciente.
  return questions.sort((a, b) => {
    // 1. Priorizar puntuación (score) descendente
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    // 2. Priorizar actividad reciente (última respuesta o fecha de creación si no tiene respuestas)
    const aActivity = a.answers.length > 0
      ? Math.max(...a.answers.map(ans => new Date(ans.createdAt).getTime()))
      : new Date(a.createdAt).getTime();

    const bActivity = b.answers.length > 0
      ? Math.max(...b.answers.map(ans => new Date(ans.createdAt).getTime()))
      : new Date(b.createdAt).getTime();

    if (bActivity !== aActivity) {
      return bActivity - aActivity;
    }

    // 3. Priorizar antigüedad (más nuevo primero)
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export async function getQuestionThread(questionId: string) {
  const question = await prisma.forumQuestion.findUnique({
    where: { id: questionId },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
        },
      },
      answers: {
        include: {
          author: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
        },
      },
    },
  });

  if (!question) {
    throw new AppError(404, 'La pregunta no existe');
  }

  // Ordenar respuestas de forma dinámica:
  // 1. Respuesta aceptada (solución destacada) va primero
  // 2. Puntuación descendente
  // 3. Antigüedad ascendente (para que fluya el hilo de discusión)
  question.answers.sort((a, b) => {
    if (a.isAccepted && !b.isAccepted) return -1;
    if (!a.isAccepted && b.isAccepted) return 1;

    if (b.score !== a.score) {
      return b.score - a.score;
    }

    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  return question;
}

export async function createQuestion(subjectId: string, authorId: string, title: string, content: string) {
  return await prisma.$transaction(async (tx) => {
    const question = await tx.forumQuestion.create({
      data: {
        title,
        content,
        subjectId,
        authorId,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Registrar log de auditoría
    await tx.forumAuditLog.create({
      data: {
        userId: authorId,
        subjectId,
        action: 'CREATE_QUESTION',
        targetId: question.id,
      },
    });

    return question;
  });
}

export async function createAnswer(questionId: string, authorId: string, content: string) {
  const question = await prisma.forumQuestion.findUnique({
    where: { id: questionId },
    select: { subjectId: true },
  });

  if (!question) {
    throw new AppError(404, 'La pregunta no existe');
  }

  return await prisma.$transaction(async (tx) => {
    const answer = await tx.forumAnswer.create({
      data: {
        content,
        questionId,
        authorId,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Registrar log de auditoría
    await tx.forumAuditLog.create({
      data: {
        userId: authorId,
        subjectId: question.subjectId,
        action: 'CREATE_ANSWER',
        targetId: answer.id,
      },
    });

    return answer;
  });
}

export async function voteQuestion(questionId: string, userId: string, value: number) {
  const question = await prisma.forumQuestion.findUnique({
    where: { id: questionId },
    select: { subjectId: true },
  });

  if (!question) {
    throw new AppError(404, 'La pregunta no existe');
  }

  return await prisma.$transaction(async (tx) => {
    const existingVote = await tx.forumQuestionVote.findUnique({
      where: {
        userId_questionId: {
          userId,
          questionId,
        },
      },
    });

    if (existingVote) {
      if (existingVote.value === value) {
        // Deshacer el voto (vuelve a 0)
        await tx.forumQuestionVote.delete({
          where: { id: existingVote.id },
        });
      } else {
        // Cambiar el voto (ej. de positivo a negativo)
        await tx.forumQuestionVote.update({
          where: { id: existingVote.id },
          data: { value },
        });
      }
    } else {
      // Crear voto
      await tx.forumQuestionVote.create({
        data: {
          userId,
          questionId,
          value,
        },
      });
    }

    // Calcular el score en tiempo real
    const agg = await tx.forumQuestionVote.aggregate({
      where: { questionId },
      _sum: { value: true },
    });

    const newScore = agg._sum.value || 0;

    const updatedQuestion = await tx.forumQuestion.update({
      where: { id: questionId },
      data: { score: newScore },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Registrar log de auditoría
    await tx.forumAuditLog.create({
      data: {
        userId,
        subjectId: question.subjectId,
        action: 'VOTE_QUESTION',
        targetId: questionId,
        metadata: { value },
      },
    });

    return updatedQuestion;
  });
}

export async function voteAnswer(answerId: string, userId: string, value: number) {
  const answer = await prisma.forumAnswer.findUnique({
    where: { id: answerId },
    include: {
      question: {
        select: { subjectId: true },
      },
    },
  });

  if (!answer) {
    throw new AppError(404, 'La respuesta no existe');
  }

  return await prisma.$transaction(async (tx) => {
    const existingVote = await tx.forumAnswerVote.findUnique({
      where: {
        userId_answerId: {
          userId,
          answerId,
        },
      },
    });

    if (existingVote) {
      if (existingVote.value === value) {
        // Deshacer el voto
        await tx.forumAnswerVote.delete({
          where: { id: existingVote.id },
        });
      } else {
        // Cambiar el voto
        await tx.forumAnswerVote.update({
          where: { id: existingVote.id },
          data: { value },
        });
      }
    } else {
      // Crear voto
      await tx.forumAnswerVote.create({
        data: {
          userId,
          answerId,
          value,
        },
      });
    }

    // Calcular el score en tiempo real
    const agg = await tx.forumAnswerVote.aggregate({
      where: { answerId },
      _sum: { value: true },
    });

    const newScore = agg._sum.value || 0;

    const updatedAnswer = await tx.forumAnswer.update({
      where: { id: answerId },
      data: { score: newScore },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Registrar log de auditoría
    await tx.forumAuditLog.create({
      data: {
        userId,
        subjectId: answer.question.subjectId,
        action: 'VOTE_ANSWER',
        targetId: answerId,
        metadata: { value },
      },
    });

    return updatedAnswer;
  });
}

export async function acceptAnswer(answerId: string, userId: string) {
  const answer = await prisma.forumAnswer.findUnique({
    where: { id: answerId },
    include: {
      question: true,
    },
  });

  if (!answer) {
    throw new AppError(404, 'La respuesta no existe');
  }

  // Validar pertenencia: sólo el autor de la pregunta puede aceptar la respuesta
  if (answer.question.authorId !== userId) {
    throw new AppError(403, 'Acción denegada: Sólo el creador de la pregunta puede marcar una respuesta como aceptada');
  }

  return await prisma.$transaction(async (tx) => {
    const wasAccepted = answer.isAccepted;

    // Desmarcar todas las otras respuestas del hilo
    await tx.forumAnswer.updateMany({
      where: { questionId: answer.questionId },
      data: { isAccepted: false },
    });

    // Alternar aceptación (toggle)
    const updatedAnswer = await tx.forumAnswer.update({
      where: { id: answerId },
      data: { isAccepted: !wasAccepted },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Registrar log de auditoría
    await tx.forumAuditLog.create({
      data: {
        userId,
        subjectId: answer.question.subjectId,
        action: 'ACCEPT_ANSWER',
        targetId: answerId,
        metadata: { accepted: !wasAccepted },
      },
    });

    return updatedAnswer;
  });
}

export async function getStudentForumHistory(subjectId: string, userId: string) {
  const [questions, answers, logs] = await Promise.all([
    prisma.forumQuestion.findMany({
      where: { subjectId, authorId: userId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.forumAnswer.findMany({
      where: {
        question: { subjectId },
        authorId: userId,
      },
      include: {
        question: {
          select: { title: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.forumAuditLog.findMany({
      where: { subjectId, userId },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return { questions, answers, logs };
}
