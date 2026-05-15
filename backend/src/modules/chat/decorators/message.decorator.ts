export interface MessageComponent {
  getContent(): string;
  process(): string;
}

export class BaseMessage implements MessageComponent {
  constructor(private content: string) {}

  getContent(): string {
    return this.content;
  }

  process(): string {
    return this.content;
  }
}

export abstract class MessageDecorator implements MessageComponent {
  constructor(protected component: MessageComponent) {}

  getContent(): string {
    return this.component.getContent();
  }

  abstract process(): string;
}

export class ProfanityFilterDecorator extends MessageDecorator {
  private badWords = ['maldito', 'estúpido', 'tonto']; // Example list

  process(): string {
    let content = this.component.process();
    this.badWords.forEach((word) => {
      const regex = new RegExp(word, 'gi');
      content = content.replace(regex, '***');
    });
    return content;
  }
}

export class HTMLSanitizerDecorator extends MessageDecorator {
  process(): string {
    const content = this.component.process();
    return content.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

export class LinkDecorator extends MessageDecorator {
  process(): string {
    const content = this.component.process();
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return content.replace(urlRegex, (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`);
  }
}

export class MentionDecorator extends MessageDecorator {
  constructor(component: MessageComponent, private memberNames: string[]) {
    super(component);
  }

  process(): string {
    let content = this.component.process();
    // Unique first names to avoid double-wrapping the same name
    const uniqueFirstNames = Array.from(new Set(this.memberNames.map(name => name.split(' ')[0])));
    
    uniqueFirstNames.forEach((firstName) => {
      // Regex that matches @firstName only if it's not already inside a span or an html attribute
      const regex = new RegExp(`(?<!<span class="mention">)@${firstName}(?!</span>)`, 'gi');
      content = content.replace(regex, `<span class="mention">@${firstName}</span>`);
    });
    return content;
  }
}

export class EmojiDecorator extends MessageDecorator {
  private emojiMap: Record<string, string> = {
    ':)': '😊',
    ':(': '☹️',
    '<3': '❤️',
    ':D': '😃',
  };

  process(): string {
    let content = this.component.process();
    Object.entries(this.emojiMap).forEach(([key, value]) => {
      content = content.split(key).join(value);
    });
    return content;
  }
}

/**
 * Helper to build a decorated message
 */
export function decorateMessage(content: string, options: { memberNames?: string[] } = {}) {
  let message: MessageComponent = new BaseMessage(content);
  
  // Order matters: Sanitizer first, then features
  message = new HTMLSanitizerDecorator(message);
  message = new EmojiDecorator(message);
  message = new ProfanityFilterDecorator(message);
  
  if (options.memberNames && options.memberNames.length > 0) {
    message = new MentionDecorator(message, options.memberNames);
  }
  
  message = new LinkDecorator(message);
  
  return message.process();
}
