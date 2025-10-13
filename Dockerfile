FROM python:3.13-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# Copy only once; code will be bind-mounted in dev
COPY src ./src
ENV PYTHONPATH=/app/src
EXPOSE 8001
CMD ["uvicorn","neuralizard.api.server:app","--host","0.0.0.0","--port","8001"]