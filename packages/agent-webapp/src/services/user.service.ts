import { ChatComponent } from '../components/chat.js';
import { HistoryComponent } from '../components/history.js';

// Chat and History components are defined in index.html
// with their respective ids so we can access them here
declare global {
  interface Window {
    chatHistory: HistoryComponent;
    chat: ChatComponent;
  }
}

let userIdPromise: Promise<string | undefined> | undefined;

export async function getUserId(refresh = false): Promise<string | undefined> {
  if (!refresh && userIdPromise) return userIdPromise;
  userIdPromise = (async () => {
    const response = await fetch(`/api/me`);
    const payload = await response.json();
    return payload?.id;
  })();
  return userIdPromise;
}

export async function initUserSession() {
  try {
    const userId = await getUserId();
    if (!userId) {
      throw new Error('User not authenticated');
    }

    // Set up user ID for chat history and chat components
    window.chatHistory.userId = userId;
    window.chatHistory.addEventListener('loadSession', (event) => {
      const { id, messages } = (event as CustomEvent).detail;
      window.chat.sessionId = id;
      window.chat.messages = messages;
    });

    window.chat.userId = userId;
    window.chat.addEventListener('messagesUpdated', () => {
      window.chatHistory.refresh();
    });
  } catch (error) {
    console.log('Error initializing user session:', error);
  }
}
