"""
Exercício 11 - Seleção para bolsas

Lê a média final de um estudante e informa se ele está apto a
participar da seleção para bolsas. Apenas estudantes com média igual
ou superior a 8,0 podem participar.
"""

media = float(input("Digite a média final do estudante: "))

if media >= 8.0:
    print("Estudante APTO a participar do processo seletivo.")
else:
    print("Estudante NÃO apto a participar do processo seletivo.")
