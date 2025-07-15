export type AuthDetails = {
  identityProvider: string;
  userId: string;
  userDetails: string;
  userRoles: string[];
  claims: { typ: string; val: string }[];
};

const userDetailsRoute = '/.auth/me';
let authDetails: AuthDetails | undefined;

export async function getUserInfo(refresh = false): Promise<AuthDetails | undefined> {
  if (authDetails && !refresh) {
    return authDetails;
  }
  const response = await fetch(userDetailsRoute);
  const payload = await response.json();
  authDetails = payload?.clientPrincipal;
  return authDetails;
}
