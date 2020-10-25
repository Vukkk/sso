const { authenticate } = require("@feathersjs/authentication").hooks;
const {
  hashPassword,
  protect,
} = require("@feathersjs/authentication-local").hooks;
const {
  iff,
  isProvider,
  disallow,
  discardQuery,
} = require("feathers-hooks-common");
const verifyHooks = require("feathers-authentication-management").hooks;
const accountService = require("../auth-management/notifier");
const streamkey = require("./streamkey");
const dispatch = require("./dispatch");
const uuid = require("./uuid");
const insensitive = require("./insensitive");

module.exports = {
  before: {
    all: [
      iff(
        isProvider("external"),
        discardQuery(
          "password",
          "title",
          "stream_password",
          "patreon",
          "twitch"
        )
      ),
    ],
    find: [authenticate("api-key"), insensitive()],
    get: [authenticate("jwt", "api-key")],
    create: [
      disallow("external"),
      uuid.create(),
      hashPassword("password"),
      streamkey.create(),
      verifyHooks.addVerification(),
    ],
    update: [disallow()],
    patch: [
      authenticate("api-key"),
      verifyHooks.addVerification()
    ],
    remove: [disallow()],
  },

  after: {
    all: [protect("password")],
    find: [iff(isProvider("external"), dispatch())],
    get: [iff(isProvider("external"), dispatch())],
    create: [
      async (context) => {
        await accountService(context.app)("resendVerifySignup", context.result);
      },
      verifyHooks.removeVerification(),
    ],
    update: [],
    patch: [
      async (context) => {
        if (typeof context.data.email !== "undefined") {
          if (!context.result.isVerified) {
            await accountService(context.app)(
              "resendVerifySignup",
              context.result
            );
            verifyHooks.removeVerification()
          }
        }
      },
    ],
    remove: [],
  },

  error: {
    all: [
      protect("password"),

      (context) => {
        console.error(
          `Error in '${context.path}' service method '${context.method}'`,
          context.error.stack
        );
      },
    ],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },
};
