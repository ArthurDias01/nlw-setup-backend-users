"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/server.ts
var import_cors = __toESM(require("@fastify/cors"));
var import_fastify = __toESM(require("fastify"));

// src/routes.ts
var import_dayjs = __toESM(require("dayjs"));

// lib/prisma.ts
var import_client = require("@prisma/client");
var prisma = new import_client.PrismaClient({});

// src/routes.ts
var import_zod = require("zod");

// src/middleware/checktoken.ts
var import_jwt_decode = __toESM(require("jwt-decode"));
async function checkToken(request, response) {
  const token = request.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    return response.status(401).send({ error: "User not Found or token expired" });
  }
  const decoded = (0, import_jwt_decode.default)(token);
  const now = new Date().getTime();
  if (decoded.exp * 1e3 < now) {
    return response.status(401).send({ error: "User not Found or token expired" });
  }
  const user = await prisma.user.findUnique({
    where: {
      firebaseId: decoded.user_id
    }
  });
  if (!user) {
    return response.status(401).send({ error: "User not Found or token expired" });
  }
  return { userId: user.id, firebaseId: decoded.user_id };
}

// lib/firebase.ts
var import_app = __toESM(require("firebase/app"));
var import_firestore = require("firebase/firestore");
var import_auth = require("firebase/auth");
var firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID
};
var app = (0, import_app.initializeApp)(firebaseConfig);
var firestoreDB = (0, import_firestore.getFirestore)(app);
var auth = (0, import_auth.getAuth)(app);

// src/routes.ts
var import_auth2 = require("firebase/auth");
async function appRoutes(app3) {
  app3.post("/register", async (request, response) => {
    const createUserBody = import_zod.z.object({
      email: import_zod.z.string().email(),
      password: import_zod.z.string()
    });
    const { email, password } = createUserBody.parse(request.body);
    if (!email || !password) {
      return response.status(422).send({ error: "Missing email or password" });
    }
    const userCredentialFirebase = await (0, import_auth2.createUserWithEmailAndPassword)(auth, email, password);
    const user = await prisma.user.create({
      data: {
        email,
        firebaseId: userCredentialFirebase.user.uid
      }
    });
    return { user };
  });
  app3.post("/habits", async (request, response) => {
    const { userId: user_id } = await checkToken(request, response);
    const createHabitBody = import_zod.z.object({
      title: import_zod.z.string(),
      weekDays: import_zod.z.array(import_zod.z.number().min(0).max(6)),
      userId: import_zod.z.string()
    });
    const { title, weekDays } = createHabitBody.parse(request.body);
    const today = (0, import_dayjs.default)().startOf("day").toDate();
    const habit = await prisma.habit.create({
      data: {
        title,
        weekDays: {
          create: weekDays.map((weekDay) => {
            return {
              week_day: weekDay,
              user: {
                connect: {
                  id: user_id
                }
              }
            };
          })
        },
        created_at: today,
        user_id
      }
    });
    return { habit };
  });
  app3.get("/day", async (request, response) => {
    const { userId: user_id } = await checkToken(request, response);
    const getDayParams = import_zod.z.object({
      date: import_zod.z.coerce.date()
    });
    const { date } = getDayParams.parse(request.query);
    const parsedDate = (0, import_dayjs.default)(date).startOf("day");
    const weekDay = (0, import_dayjs.default)(date).get("day");
    const possibleHabits = await prisma.habit.findMany({
      where: {
        created_at: {
          lte: date
        },
        weekDays: {
          some: {
            week_day: weekDay
          }
        },
        user_id: {
          equals: user_id
        }
      }
    });
    const day = await prisma.day.findUnique({
      where: {
        date: parsedDate.toDate()
      },
      include: {
        dayHabits: true
      }
    });
    const completedHabits = day?.dayHabits.map((dayHabit) => {
      return dayHabit.habit_id;
    }) ?? [];
    return { possibleHabits, completedHabits };
  });
  app3.patch("/habits/:id/toggle", async (request, response) => {
    const { userId } = await checkToken(request, response);
    if (!userId)
      return response.status(401).send({ error: "Unauthorized" });
    const toggleHabitParams = import_zod.z.object({
      id: import_zod.z.string().uuid()
    });
    const { id } = toggleHabitParams.parse(request.params);
    const today = (0, import_dayjs.default)().startOf("day").toDate();
    let day = await prisma.day.findUnique({
      where: {
        date: today
      }
    });
    if (!day) {
      day = await prisma.day.create({
        data: {
          date: today
        }
      });
    }
    const dayHabit = await prisma.dayHabit.findUnique({
      where: {
        day_id_habit_id: {
          day_id: day.id,
          habit_id: id
        }
      }
    });
    if (!dayHabit) {
      await prisma.dayHabit.create({
        data: {
          day_id: day.id,
          habit_id: id
        }
      });
    } else {
      await prisma.dayHabit.delete({
        where: {
          id: dayHabit.id
        }
      });
    }
  });
  app3.get("/summary", async (request, response) => {
    response.header("Access-Control-Allow-Origin", "*");
    const { userId } = await checkToken(request, response);
    const summary = await prisma.$queryRaw`
    SELECT
                D.id,
                D.date,
                (
                    SELECT
                        cast(COUNT(*) as integer)
                    FROM day_habits DH
                    WHERE DH.day_id = D.id
                ) as completed,
                (
                    SELECT
                       cast(COUNT(*) as integer)
                    FROM habit_week_days HWD
                    JOIN habits H
                        ON H.id = HWD.habit_id
                    WHERE
                        HWD.week_day = date_part('dow', to_timestamp(extract(epoch from D.date) :: numeric / 1000.0))
                        AND H.created_at <= D.date
                        AND H.user_id = ${userId}
                ) as amount
            FROM days D
          `;
    return summary;
  });
  app3.post("/resetpassword", async (request, response) => {
    const resetEmailBody = import_zod.z.object({
      email: import_zod.z.string().email()
    });
    const { email } = resetEmailBody.parse(request.body);
    if (!email) {
      return response.status(422).send({ error: "Missing email" });
    }
    const user = await prisma.user.findUnique({
      where: {
        email
      }
    });
    if (!user) {
      return response.status(422).send({ error: "User not found" });
    }
    try {
      await (0, import_auth2.sendPasswordResetEmail)(auth, user.email);
    } catch (error) {
      return response.status(422).send({ error: "Error sending email" });
    }
    return { message: "Email sent" };
  });
}

// src/server.ts
var app2 = (0, import_fastify.default)();
app2.addHook("onSend", (req, res, payload, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  console.log("req", JSON.stringify(req.headers, null, 2));
  next();
});
app2.register(import_cors.default, {
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "Origin", "X-Requested-With", "Accept", "Access-Control-Allow-Origin"],
  credentials: true,
  optionsSuccessStatus: 200
});
app2.register(appRoutes);
app2.listen({
  port: 3333,
  host: "0.0.0.0"
}).then((address) => {
  console.log("Server is running on port 3333!");
});