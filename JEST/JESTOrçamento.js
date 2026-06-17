describe('Orçamento', () => {

  const calcularTotal = (
    largura,
    altura,
    precoUnit
  ) => {

    const area =
      (largura * altura) / 1000;

    return area * precoUnit;
  };

  test('deve calcular orçamento corretamente', () => {

    expect(
      calcularTotal(
        100,
        50,
        20
      )
    ).toBe(100);
  });

  test('deve retornar zero com largura zero', () => {

    expect(
      calcularTotal(
        0,
        50,
        20
      )
    ).toBe(0);
  });

});