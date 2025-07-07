declare global {
  interface Window {
    chatHistory: any;
    chat: any;
  }
}

let userId: string | undefined;

export async function getUserId(refresh = false): Promise<string | undefined> {
  if (userId && !refresh) {
    return userId;
  }
  const response = await fetch(`/api/me`);
  const payload = await response.json();
  userId = payload?.id;
  return userId;
}

export async function initUserSession() {
  try {
    const userId = await getUserId();
    if (!userId) {
      throw new Error('User not authenticated');
    }

    // Set up user ID for chat history and chat components
    window.chatHistory.userId = userId;
    window.chatHistory.addEventListener('loadSession', (e) => {
      const { id, messages } = e.detail;
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
