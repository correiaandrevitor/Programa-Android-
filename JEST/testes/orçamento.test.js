describe('Cálculo de orçamento', () => {

  function calcularTotal(
    largura,
    altura,
    preco
  ) {

    return (
      (largura * altura / 1000)
      * preco
    );
  }

  test('calcula orçamento corretamente', () => {

    const total = calcularTotal(
      104,
      73,
      2.3
    );

    expect(total)
      .toBeCloseTo(17.4616);
  });

  test('retorna zero quando largura for zero', () => {

    const total = calcularTotal(
      0,
      5,
      1.50
    );

    expect(total)
      .toBe(0);
  });

  test('retorna zero quando altura for zero', () => {

    const total = calcularTotal(
      10,
      0,
      1.50
    );

    expect(total)
      .toBe(0);
  });

});