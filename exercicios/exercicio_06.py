"""
Exercício 06 - Classificação de equipamentos

Lê o código de um equipamento e informa se ele é par (setor
administrativo) ou ímpar (setor operacional).
"""

codigo = int(input("Digite o código do equipamento: "))

if codigo % 2 == 0:
    print(f"O código {codigo} é PAR (setor administrativo).")
else:
    print(f"O código {codigo} é ÍMPAR (setor operacional).")
