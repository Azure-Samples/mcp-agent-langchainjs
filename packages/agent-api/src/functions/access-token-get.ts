import { createHash, randomUUID } from "node:crypto";
import {
  app,
  type HttpRequest,
  type InvocationContext,
} from "@azure/functions";
import { UserDbService } from "../user-db-service.js";
import { getUserInfo } from "../security.js";

app.http("access-token", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "me/access-token",
  async handler(request: HttpRequest, context: InvocationContext) {
    try {
      const userInfo = getUserInfo(request);
      if (!userInfo || !userInfo.userId) {
        return {
          status: 401,
          jsonBody: { error: "Unauthorized" },
        };
      }

      const { userId } = userInfo;
      const hash = createHash("sha256").update(userId).digest("base64");
      context.log(`User hash ${hash}`);

      const db = await UserDbService.getInstance();
      let user = await db.getUserByHash(hash);
      if (!user) {
        // Create new user with unique accessToken
        const accessToken = randomUUID();
        user = await db.createUser(hash, accessToken);
        context.log(`Created new user with accessToken: ${accessToken}`);
      } else {
        context.log(`User exists, returning accessToken: ${user.accessToken}`);
      }

      return {
        jsonBody: { accessToken: user.accessToken },
      };
    } catch (error) {
      context.error("Error in access-token handler", error);
      return {
        status: 500,
        jsonBody: { error: "Internal Server Error" },
      };
    }
  },
});
