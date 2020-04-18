# 웹서버 로깅 파이프라인(Centralized Logging Pipeline)을 구축

## 목표
* nginx access log data를 fluentd를 통하여 kinesis로 1분 단위로 전송
* kinesis stream을 lambda가 받아 json 형태로 변환하여 S3에 업로드
* 모든 것을 [localstack](https://localstack.cloud)으로 확인

## 사전 준비 - localstack, nginx, fluentd 
#### 1. kinesis-stream 처리를 위한 fluend docker image 생성
```
$ docker build -t custom-fluentd:latest .
```
[Dockerfile](localstack/fluentd/Dockerfile) 참고

#### 2. Docker compose 파일 준비 - localstack, nginx, fluentd
```
version: '3'

services:
  localstack:
    container_name: "localstack"
    image: localstack/localstack
    ports:
      - "4566-4599:4566-4599"
      - "${PORT_WEB_UI-4566}:${PORT_WEB_UI-8080}"
    environment:
      -- SERVICES=${SERVICES-lambda,kinesis,s3 }
      - DEBUG=${DEBUG-1 }
      - DATA_DIR=${DATA_DIR- }
      - PORT_WEB_UI=${PORT_WEB_UI- }
      - LAMBDA_EXECUTOR=${LAMBDA_EXECUTOR-docker-reuse }
      - KINESIS_ERROR_PROBABILITY=${KINESIS_ERROR_PROBABILITY- }
      - DOCKER_HOST=unix:///var/run/docker.sock
    volumes:
      - "./localstack:/tmp/localstack"
      - "/var/run/docker.sock:/var/run/docker.sock"

  nginx:
    container_name: nginx
    image: nginx:latest
    ports:
      - "80:80"
    volumes:
      - "./nginx/conf/nginx.conf:/etc/nginx/nginx.conf"
      - "./nginx/log:/var/log/nginx"

  fluentd:
    container_name: fluentd
    image: custom-fluentd:latest
    ports:
      - "24224:24224"
    volumes:
      - "./fluentd/fluent.conf:/fluentd/etc/fluent.conf"
      - "./nginx/log:/var/log/nginx"
```
#### 3. docker compose up으로 docker 구동
```
MacOS : $ TMPDIR=/private$TMPDIR docker-compose up -d
Others : $ docker-compose up -d
```

#### 4. localstack 로그 확인 또는 health check 를 통해 서비스 상태 확인
```
http://localhost:8080/health
```

#### (Option) install LocalStack AWS CLI
```
$ pip install awscli-local
```

#### 5. terraform 적용 - terraform 으로 localstack에 인프라 구성
- 적용하기 위한 명령 :

```
$ terraform init
$ terraform plan
$ terraform apply
```

- 테스트 후 destory :
```
$ terraform destroy
```

#### 6. nginx log 생성 시 처리 내용 확인
```
$ docker logs -f localstack
```
