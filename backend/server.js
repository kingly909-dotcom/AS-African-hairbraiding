const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const { randomUUID } = require("crypto");

const app = express();

const PORT = 3000;
const ROOT_DIR = path.join(__dirname, "..");
const DATA_DIR = path.join(__dirname, "data");
const APPOINTMENTS_FILE = path.join(DATA_DIR, "appointments.json");
const AVAILABLE_TIMES = [
    "8:00 AM",
    "10:00 AM",
    "12:00 PM",
    "2:00 PM",
    "4:00 PM",
    "6:00 PM"
];
let appointmentWriteQueue = Promise.resolve();

app.use(express.json());
app.use(express.static(ROOT_DIR));

async function readAppointments() {
    try {
        const file = await fs.readFile(APPOINTMENTS_FILE, "utf8");
        return JSON.parse(file);
    } catch (error) {
        if (error.code === "ENOENT") {
            return [];
        }

        throw error;
    }
}

async function writeAppointments(appointments) {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(
        APPOINTMENTS_FILE,
        JSON.stringify(appointments, null, 2)
    );
}

function isValidDate(date) {
    return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

function normalizeText(value) {
    return String(value || "").trim();
}

async function withAppointmentLock(task) {
    const runTask = appointmentWriteQueue.then(task, task);

    appointmentWriteQueue = runTask.catch(() => {});

    return runTask;
}

app.get("/api/test", (req, res) => {
    res.json({
        message: "The AS African Hair Braiding API is working!"
    });
});

app.get("/api/times", (req, res) => {
    res.json({
        times: AVAILABLE_TIMES
    });
});

app.get("/api/availability", async (req, res, next) => {
    try {
        const date = normalizeText(req.query.date);

        if (!isValidDate(date)) {
            return res.status(400).json({
                message: "Please choose a valid appointment date."
            });
        }

        const appointments = await readAppointments();
        const bookedTimes = appointments
            .filter((appointment) => {
                return appointment.date === date
                    && appointment.status === "confirmed";
            })
            .map((appointment) => appointment.time);

        const availableTimes = AVAILABLE_TIMES.filter((time) => {
            return !bookedTimes.includes(time);
        });

        res.json({
            date,
            availableTimes,
            bookedTimes
        });
    } catch (error) {
        next(error);
    }
});

app.post("/api/appointments", async (req, res, next) => {
    try {
        const name = normalizeText(req.body.name);
        const phone = normalizeText(req.body.phone);
        const service = normalizeText(req.body.service);
        const date = normalizeText(req.body.date);
        const time = normalizeText(req.body.time);

        if (!name || !phone || !service || !date || !time) {
            return res.status(400).json({
                message: "Please complete every booking field."
            });
        }

        if (!isValidDate(date)) {
            return res.status(400).json({
                message: "Please choose a valid appointment date."
            });
        }

        if (!AVAILABLE_TIMES.includes(time)) {
            return res.status(400).json({
                message: "Please choose one of the available appointment times."
            });
        }

        const appointment = await withAppointmentLock(async () => {
            const appointments = await readAppointments();
            const alreadyBooked = appointments.some((savedAppointment) => {
                return savedAppointment.date === date
                    && savedAppointment.time === time
                    && savedAppointment.status === "confirmed";
            });

            if (alreadyBooked) {
                return null;
            }

            const newAppointment = {
                id: randomUUID(),
                name,
                phone,
                service,
                date,
                time,
                status: "confirmed",
                createdAt: new Date().toISOString()
            };

            appointments.push(newAppointment);
            await writeAppointments(appointments);

            return newAppointment;
        });

        if (!appointment) {
            return res.status(409).json({
                message: "That time was just booked. Please choose another available time."
            });
        }

        res.status(201).json({
            message: "Your appointment is confirmed. We look forward to seeing you!",
            appointment: {
                id: appointment.id,
                service: appointment.service,
                date: appointment.date,
                time: appointment.time,
                status: appointment.status
            }
        });
    } catch (error) {
        next(error);
    }
});

app.use((error, req, res, next) => {
    console.error(error);
    res.status(500).json({
        message: "Something went wrong. Please try again or call the salon."
    });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
