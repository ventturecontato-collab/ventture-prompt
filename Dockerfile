# Sistema de Teste de Prompts - imagem de producao.
# O app usa SO a biblioteca padrao do Python, entao nao ha "pip install".
FROM python:3.13-slim

WORKDIR /app

# Copia o codigo (config.json e o banco ficam de fora via .dockerignore).
COPY . .

# Porta padrao; a plataforma pode injetar PORT que o server.py respeita.
ENV PORT=8000
EXPOSE 8000

# Saida sem buffer para os logs aparecerem em tempo real no painel.
ENV PYTHONUNBUFFERED=1

CMD ["python", "server.py"]
