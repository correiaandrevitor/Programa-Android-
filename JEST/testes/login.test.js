const { AuthService } = require('./services/AuthService');

global.fetch = jest.fn();

describe('AuthService Login', () => {
  beforeEach(() => {
    fetch.mockClear();
    AuthService.currentUser = null;
  });

  test('deve fazer login com sucesso', async () => {
    fetch.mockResolvedValueOnce({
      json: async () => ({
        localId: '123',
        email: 'teste@email.com',
        idToken: 'token123',
        refreshToken: 'refresh123',
      }),
    });

    const resultado = await AuthService.login(
      'teste@email.com',
      'Senha@123'
    );

    expect(resultado.ok).toBe(true);

    expect(resultado.user).toEqual({
      id: '123',
      email: 'teste@email.com',
      token: 'token123',
      refreshToken: 'refresh123',
    });

    expect(AuthService.currentUser.email)
      .toBe('teste@email.com');
  });

  test('deve retornar erro quando firebase rejeitar login', async () => {
    fetch.mockResolvedValueOnce({
      json: async () => ({
        error: {
          message: 'INVALID_PASSWORD',
        },
      }),
    });

    const resultado = await AuthService.login(
      'teste@email.com',
      'senhaErrada'
    );

    expect(resultado.ok).toBe(false);
    expect(resultado.erro).toBe('INVALID_PASSWORD');
  });

  test('deve retornar erro de conexão', async () => {
    fetch.mockRejectedValueOnce(
      new Error('Network Error')
    );

    const resultado = await AuthService.login(
      'teste@email.com',
      'Senha@123'
    );

    expect(resultado.ok).toBe(false);

    expect(resultado.erro).toBe(
      'Erro de conexão. Verifique sua internet.'
    );
  });
});