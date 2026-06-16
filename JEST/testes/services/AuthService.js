const API_KEY = "SUA_API_KEY";
const AUTH_URL = "https://identitytoolkit.googleapis.com/v1/accounts";

const AuthService = {
  currentUser: null,

  async login(email, senha) {
    try {
      const res = await fetch(
        `${AUTH_URL}:signInWithPassword?key=${API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            password: senha,
            returnSecureToken: true,
          }),
        }
      );

      const data = await res.json();

      if (data.error) {
        return {
          ok: false,
          erro: data.error.message,
        };
      }

      this.currentUser = {
        id: data.localId,
        email: data.email,
        token: data.idToken,
        refreshToken: data.refreshToken,
      };

      return {
        ok: true,
        user: this.currentUser,
      };
    } catch (e) {
      return {
        ok: false,
        erro: 'Erro de conexão. Verifique sua internet.',
      };
    }
  },

  logout() {
    this.currentUser = null;
  },
};

module.exports = { AuthService };