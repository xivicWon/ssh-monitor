FROM nginx:1.27-alpine

# 기본 설정 제거
RUN rm /etc/nginx/conf.d/default.conf

# 커스텀 설정 복사
COPY nginx.conf /etc/nginx/nginx.conf
COPY conf.d/ /etc/nginx/conf.d/

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
