"""
Exercício 05 - Desconto promocional

Lê o valor da compra e informa se o cliente tem direito ao desconto
promocional. Compras com valor igual ou superior a R$ 500,00 têm
direito ao benefício.
"""

valor = float(input("Digite o valor da compra (R$): "))

if valor >= 500:
    print("Cliente tem direito ao desconto promocional!")
else:
    print("Cliente não tem direito ao desconto promocional.")
