
import cors from '@fastify/cors';
import Fastify from "fastify";
import { appRoutes } from './routes';


const app = Fastify();


app.register(cors, {
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "Origin", "X-Requested-With", "Accept"],
  credentials: true,
});
app.register(appRoutes);



app.listen({
  port: 3333,
  host: "0.0.0.0"
}).then(() => {
  console.log("Server is running on port 3333!");
})
