"use client";
import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";

interface Request {
  headers: Record<string, string>;
  [key: string]: any;
}

export default function SwaggerPage() {
  return (
    <div className="h-screen">
      <SwaggerUI 
        url="/api/swagger" 
        docExpansion="list"
        defaultModelsExpandDepth={-1}
        persistAuthorization={false}
        deepLinking={false}
        tryItOutEnabled={true}
        requestInterceptor={(req: Request) => {
          req.headers = {
            ...req.headers,
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          };
          return req;
        }}
      />
    </div>
  );
} 