FROM public.ecr.aws/docker/library/httpd:2.4

RUN echo '<html><body><h1>Apache Blue/Green Deployment - Version 4.0</h1><p>Testing auto-trigger with polling detection! ⏱️</p></body></html>' > /usr/local/apache2/htdocs/index.html

EXPOSE 80

CMD ["httpd-foreground"]