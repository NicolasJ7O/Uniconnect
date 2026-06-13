import { PollSubject } from './poll.subject.js';
import { PollGroupObserver } from './poll.observer.js';

const pollSubject = PollSubject.getInstance();

pollSubject.attach(new PollGroupObserver());

export { pollSubject };
