const { AuthenticationService, JWTStrategy } = require('@feathersjs/authentication');
const { LocalStrategy } = require('@feathersjs/authentication-local');
const { expressOauth, OAuthStrategy } = require('@feathersjs/authentication-oauth');
const axios = require('axios');
const redis = require('redis');
const session = require('express-session');
const RedisStore = require('connect-redis')(session);
const redisClient = redis.createClient();

class PatreonStrategy extends OAuthStrategy {

  constructor(app) {
    super(app);
  }

  async getProfile (authResult) {
    const accessToken = authResult.access_token;

    let { data } = 
    await axios.get('https://www.patreon.com/api/oauth2/v2/identity', {
      headers: {
        authorization: `Bearer ${accessToken}`
      }
    });

    data.access_token = authResult.access_token;
    data.refresh_token = authResult.refresh_token;

    return data;
  }

  async getEntityData(profile) {
    const baseData = await super.getEntityData(profile.data);

    return {
      patreon: {
        ...baseData,
        isPatron: false,
        tier: 0,
        access_token: profile.access_token,
        refresh_token: profile.refresh_token
      }
    };
  }

  getEntityQuery(profile) {
    const query = {"patreon.id": profile.data.id}
    return {
        ...query,
        $limit: 1
    };
  }

  async getRedirect (data) {
    return `${this.app.get('authentication').oauth.redirect}`
  }
}

class TwitchStrategy extends OAuthStrategy {
  constructor(app) {
    super(app);
  }

  async getProfile (authResult) {
    const accessToken = authResult.access_token;

    let { data } = 
    await axios.get('https://api.twitch.tv/helix/users', {
      headers: {
        authorization: `Bearer ${accessToken}`
      }
    }).catch(e => {
      console.error(e);
    });
    data = data.data[0];

    data.access_token = authResult.access_token;
    data.refresh_token = authResult.refresh_token;

    return data;
  }

  async getEntityData(profile) {
    const baseData = await super.getEntityData(profile);

    return {
      twitchChannel: profile.login,
      twitch: {
        ...baseData,
        access_token: profile.access_token,
        refresh_token: profile.refresh_token
      }
    };
  }

  getEntityQuery(profile) {
    const query = {"twitch.id": profile.id}
    return {
        ...query,
        $limit: 1
    };
  }

  async getRedirect (data) {
    return `${this.app.get('authentication').oauth.redirect}`
  }
}

module.exports = app => {
  const authentication = new AuthenticationService(app);

  authentication.register('jwt', new JWTStrategy());
  authentication.register('local', new LocalStrategy());
  authentication.register('patreon', new PatreonStrategy(app));
  authentication.register('twitch', new TwitchStrategy(app));

  app.use('/authentication', authentication);
  app.configure(expressOauth({
    expressSession: session({
      store: new RedisStore({ client: redisClient }),
      secret: app.get('sessionSecret'),
      resave: false,
      saveUninitialized: true
    })
  }));
};