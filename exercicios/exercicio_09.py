"""
Exercício 09 - Livros mais emprestados

Lê os títulos de três livros, armazena-os em uma lista e exibe todos
os títulos cadastrados.
"""

livros = []

for i in range(1, 4):
    titulo = input(f"Digite o título do livro {i}: ")
    livros.append(titulo)

print("\nTítulos cadastrados:")
for titulo in livros:
    print(f"- {titulo}")
