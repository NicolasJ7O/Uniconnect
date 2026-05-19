import type { Request, Response } from 'express';
import { getStudentProfile, updateStudentProfile, getAllSubjects, searchStudentsByName, getStudentProfileById } from './student.service.js';
import { updateProfileSchema } from './student.schemas.js';
import { catchAsync } from '../../lib/catch-async.js';

export const getProfileHandler = catchAsync(async (req: Request, res: Response) => {
    const payload = req.user!;
    const profile = await getStudentProfile(payload.sub, payload);
    res.json(profile);
});

export const getProfileByIdHandler = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const vista = req.query.vista as string;
    const vistaCompleta = vista === 'completa';
    const profile = await getStudentProfileById(id, vistaCompleta);
    res.json(profile);
});

export const updateProfileHandler = catchAsync(async (req: Request, res: Response) => {
    const payload = req.user!;

    // Validate request body
    const data = updateProfileSchema.parse(req.body);

    const updatedProfile = await updateStudentProfile(payload.sub, data, payload);
    res.json(updatedProfile);
});

export const getSubjectsHandler = catchAsync(async (req: Request, res: Response) => {
    const subjects = await getAllSubjects();
    res.json(subjects);
});

export const searchStudentsHandler = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user!.sub;
    const query = req.query.name as string;
    const students = await searchStudentsByName(query, userId, req.user);
    res.json(students);
});
