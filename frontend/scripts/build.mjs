import { build } from 'vite';

// Le terminal peut hériter de NODE_ENV=development ; le bundle livré reste de production.
process.env.NODE_ENV = 'production';
await build();
