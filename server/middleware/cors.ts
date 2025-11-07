import cors from "cors";

// Get allowed origins from environment variables
const getAllowedOrigins = () => {
  const origins = [
    'http://localhost:3000', 
    'http://localhost:3001', 
    'http://localhost:3002', 
    'http://localhost:3003', 
    'http://localhost:3004'
  ];
  
  // Add production origins from environment variables
  if (process.env.FRONTEND_URL) {
    origins.push(process.env.FRONTEND_URL);
  }
  
  if (process.env.NODE_ENV === 'production') {
    // Add common production domains
    origins.push('https://marico-insight.vercel.app');
    origins.push('https://marico-insighting-tool2.vercel.app');
    origins.push('https://marico-insighting-tool2-fdll.vercel.app');
    origins.push('https://marico-insighting-tool2-git-dev-sameers-projects-c785670d.vercel.app');
    origins.push('https://marico-insight.netlify.app');
    origins.push('https://vocal-toffee-30f0ce.netlify.app');
  }
  
  return origins;
};

export const corsConfig = cors({
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    const allowedOrigins = getAllowedOrigins();
    
    console.log('CORS Origin check:', origin);
    console.log('Allowed origins:', allowedOrigins);
    
    // Allow requests with no origin (like mobile apps, curl, or some browsers)
    if (!origin) {
      console.log('Request with no origin - allowing');
      return callback(null, true);
    }
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      console.log('Origin allowed:', origin);
      return callback(null, true);
    }
    
    // Allow any Netlify domain in production
    if (process.env.NODE_ENV === 'production' && origin && origin.includes('.netlify.app')) {
      console.log('Allowing Netlify domain:', origin);
      return callback(null, true);
    }
    
    // Allow any Vercel domain in production
    if (process.env.NODE_ENV === 'production' && origin && origin.includes('.vercel.app')) {
      console.log('Allowing Vercel domain:', origin);
      return callback(null, true);
    }
    
    // Allow any Render domain in production
    if (process.env.NODE_ENV === 'production' && origin && origin.includes('.onrender.com')) {
      console.log('Allowing Render domain:', origin);
      return callback(null, true);
    }
    
    // Allow localhost in development
    if (process.env.NODE_ENV !== 'production' && origin && origin.includes('localhost')) {
      console.log('Allowing localhost in development:', origin);
      return callback(null, true);
    }
    
    console.log('CORS blocked origin:', origin);
    console.log('Allowed origins:', allowedOrigins);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers',
    'X-User-Email',  // Allow custom user email header
    'x-user-email',  // Allow lowercase version too
    'X-User-Name',   // Allow custom user name header
    'x-user-name'    // Allow lowercase version too
  ],
  exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar'],
  optionsSuccessStatus: 200,
  preflightContinue: false
});
