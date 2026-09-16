---
sidebar_position: 1
title: Installation
description: Install Web Note on various platforms
---

# Installation

Web Note can be deployed on various platforms. Choose the method that best fits your infrastructure.

## Docker (Recommended)

### Standard Docker Compose

See [Getting Started](/docs/getting-started#quick-start-with-docker-compose).

### With Reverse Proxy (Nginx)

```yaml
version: '3.8'
services:
  webnote:
    image: ghcr.io/web-note/web-note:latest
    container_name: webnote
    expose:
      - "8080"
    volumes:
      - ./data:/data
      - ./app-data:/app-data
    environment:
      - NODE_ENV=production
      - MASTER_ENCRYPTION_KEY=${MASTER_ENCRYPTION_KEY}
      - TZ=UTC
    restart: unless-stopped
    networks:
      - webnote-network

  nginx:
    image: nginx:alpine
    container_name: webnote-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certbot/conf:/etc/letsencrypt:ro
      - ./certbot/www:/var/www/certbot:ro
    depends_on:
      - webnote
    restart: unless-stopped
    networks:
      - webnote-network

networks:
  webnote-network:
    driver: bridge
```

### With Traefik

```yaml
version: '3.8'
services:
  webnote:
    image: ghcr.io/web-note/web-note:latest
    container_name: webnote
    expose:
      - "8080"
    volumes:
      - ./data:/data
      - ./app-data:/app-data
    environment:
      - NODE_ENV=production
      - MASTER_ENCRYPTION_KEY=${MASTER_ENCRYPTION_KEY}
      - TZ=UTC
    restart: unless-stopped
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.webnote.rule=Host(`notes.yourdomain.com`)"
      - "traefik.http.routers.webnote.tls=true"
      - "traefik.http.routers.webnote.tls.certresolver=letsencrypt"
      - "traefik.http.services.webnote.loadbalancer.server.port=8080"
    networks:
      - traefik-network

networks:
  traefik-network:
    external: true
```

## FNOS (Friendly NAS OS)

1. Open FNOS App Store
2. Search for "Web Note"
3. Click **Install**
4. Configure:
   - **Data Volume**: `/volume1/docker/webnote/data`
   - **App Data Volume**: `/volume1/docker/webnote/app-data`
   - **Environment Variables**:
     - `MASTER_ENCRYPTION_KEY`: Generate with `openssl rand -base64 32`
     - `TZ`: Your timezone (e.g., `Asia/Shanghai`)
5. Click **Install**
6. Access via FNOS dashboard or `http://your-nas-ip:8080`

## Kubernetes

### Helm Chart (Recommended)

```bash
# Add repo (when available)
helm repo add web-note https://web-note.github.io/helm-charts
helm repo update

# Install
helm install web-note web-note/web-note \
  --namespace webnote \
  --create-namespace \
  --set masterEncryptionKey=$(openssl rand -base64 32) \
  --set persistence.data.size=10Gi \
  --set persistence.appData.size=5Gi
```

### Raw Manifests

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: webnote
---
apiVersion: v1
kind: Secret
metadata:
  name: webnote-secrets
  namespace: webnote
type: Opaque
stringData:
  master-key: "your-32-char-minimum-secret-key"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: webnote
  namespace: webnote
spec:
  replicas: 1
  selector:
    matchLabels:
      app: webnote
  template:
    metadata:
      labels:
        app: webnote
    spec:
      containers:
      - name: webnote
        image: ghcr.io/web-note/web-note:latest
        ports:
        - containerPort: 8080
        env:
        - name: MASTER_ENCRYPTION_KEY
          valueFrom:
            secretKeyRef:
              name: webnote-secrets
              key: master-key
        - name: NODE_ENV
          value: "production"
        - name: TZ
          value: "UTC"
        volumeMounts:
        - name: data
          mountPath: /data
        - name: app-data
          mountPath: /app-data
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 10
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: webnote-data
      - name: app-data
        persistentVolumeClaim:
          claimName: webnote-app-data
---
apiVersion: v1
kind: Service
metadata:
  name: webnote
  namespace: webnote
spec:
  selector:
    app: webnote
  ports:
  - port: 80
    targetPort: 8080
  type: ClusterIP
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: webnote-data
  namespace: webnote
spec:
  accessModes: ["ReadWriteOnce"]
  resources:
    requests:
      storage: 10Gi
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: webnote-app-data
  namespace: webnote
spec:
  accessModes: ["ReadWriteOnce"]
  resources:
    requests:
      storage: 5Gi
```

## Bare Metal / VPS

### Systemd Service

```ini
# /etc/systemd/system/webnote.service
[Unit]
Description=Web Note
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
Restart=always
RestartSec=10
WorkingDirectory=/opt/webnote
ExecStartPre=/usr/bin/docker compose pull
ExecStart=/usr/bin/docker compose up
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=120

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable webnote
sudo systemctl start webnote
```

## Synology DSM

1. Open **Package Center** → **Settings** → **Package Sources** → **Add**
   - Name: `Web Note`
   - Location: `https://web-note.github.io/synology/`
2. Install **Web Note** from **Community** packages
3. Configure volumes in **Package Center** → **Web Note** → **Edit**

## QNAP

1. Open **App Center** → **Settings** → **App Repository** → **Add**
   - Name: `Web Note`
   - URL: `https://web-note.github.io/qnap/`
2. Install **Web Note** from **App Center**

## Portainer

1. Open Portainer
2. Go to **Stacks** → **Add Stack**
3. Name: `webnote`
4. Paste the Docker Compose configuration
4. Add environment variables
5. Deploy

## Verification

After installation, verify:

```bash
# Check container status
docker ps | grep webnote

# Check logs
docker logs webnote

# Test health endpoint
curl http://localhost:8080/health

# Test API
curl http://localhost:8080/api/v1/health
```

## Next Steps

- [Configuration](/docs/guides/configuration) - Customize your installation
- [First Library](/docs/guides/libraries) - Create your first knowledge base
- [Security Hardening](/docs/security/best-practices) - Secure your deployment