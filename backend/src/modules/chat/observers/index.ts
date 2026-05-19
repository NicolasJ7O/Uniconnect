import { ChatSubject } from './chat.subject.js';
import { GroupChatObserver } from './group-chat.observer.js';
import { PrivateChatObserver } from './private-chat.observer.js';

const chatSubject = ChatSubject.getInstance();

// Auto-register observers
chatSubject.attach(new GroupChatObserver());
chatSubject.attach(new PrivateChatObserver());

export { chatSubject };
