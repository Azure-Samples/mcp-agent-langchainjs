export type AuthDetails = {
  identityProvider: string;
  userId: string;
  userDetails: string;
  userRoles: string[];
  claims: Array<{ typ: string; val: string }>;
};

const userDetailsRoute = '/.auth/me';
let authDetailsPromise: Promise<AuthDetails | undefined> | undefined;

export async function getUserInfo(refresh = false): Promise<AuthDetails | undefined> {
  if (!refresh && authDetailsPromise) {
    return authDetailsPromise;
  }

  authDetailsPromise = (async () => {
    const response = await fetch(userDetailsRoute);
    const payload = await response.json();
    return payload?.clientPrincipal;
  })();

  return authDetailsPromise;
}
