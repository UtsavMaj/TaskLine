/**
 * Seeds two test accounts with a few projects and tasks. Only fake data.
 *   demo@taskline.dev  / Demo@1234   (USER)
 *   admin@taskline.dev / Admin@1234  (ADMIN)
 * Running it again resets these two accounts and leaves everybody else alone.
 */
import { PrismaClient, type TaskPriority, type TaskStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const day = 24 * 60 * 60 * 1000;
function dateFromToday(offsetDays: number) {
  const today = new Date();
  const utc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return new Date(utc + offsetDays * day);
}

type SeedTask = [
  name: string,
  priority: TaskPriority,
  status: TaskStatus,
  dueInDays: number | null,
  description?: string,
];

const projects: {
  name: string;
  description: string | null;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  start: number;
  end: number;
  tasks: SeedTask[];
}[] = [
  {
    name: 'Campus fest website',
    description: 'Event site for the annual tech fest: schedule, registrations and sponsor pages.',
    status: 'IN_PROGRESS',
    start: -20,
    end: 25,
    tasks: [
      ['Finalise colour palette and type scale', 'MEDIUM', 'COMPLETED', -12],
      ['Build event schedule page', 'HIGH', 'IN_PROGRESS', 1, 'Day-wise tabs, filter by venue.'],
      ['Registration form with payment link', 'HIGH', 'PENDING', 4],
      ['Sponsor logo wall', 'LOW', 'PENDING', 10],
      ['Lighthouse pass on mobile', 'MEDIUM', 'PENDING', -2, 'Target 90+ performance.'],
      ['Set up analytics', 'LOW', 'COMPLETED', -8],
    ],
  },
  {
    name: 'Android attendance app',
    description: 'QR based attendance for lab sessions, synced with the department sheet.',
    status: 'NOT_STARTED',
    start: 5,
    end: 60,
    tasks: [
      ['Write requirement notes with the lab in-charge', 'MEDIUM', 'PENDING', 6],
      ['Pick QR scanning library', 'LOW', 'PENDING', 9],
      ['Sketch the three main screens', 'MEDIUM', 'PENDING', 12],
    ],
  },
  {
    name: 'Semester 5 mini project',
    description: 'Library seat booking system - report, demo and viva preparation.',
    status: 'COMPLETED',
    start: -90,
    end: -15,
    tasks: [
      ['Database design and ER diagram', 'HIGH', 'COMPLETED', -70],
      ['Booking API', 'HIGH', 'COMPLETED', -45],
      ['Project report', 'MEDIUM', 'COMPLETED', -20],
      ['Viva slides', 'MEDIUM', 'COMPLETED', -16],
    ],
  },
  {
    name: 'Personal portfolio refresh',
    description: null,
    status: 'IN_PROGRESS',
    start: -5,
    end: 14,
    tasks: [
      ['Rewrite the about section', 'LOW', 'IN_PROGRESS', 3],
      ['Add case study for the fest website', 'MEDIUM', 'PENDING', null],
    ],
  },
];

async function upsertUser(email: string, fullName: string, password: string, role: 'USER' | 'ADMIN') {
  await prisma.user.deleteMany({ where: { email } }); // cascades to projects, tasks, sessions, logs
  return prisma.user.create({
    data: { email, fullName, role, passwordHash: await bcrypt.hash(password, 12) },
  });
}

async function main() {
  const demo = await upsertUser('demo@taskline.dev', 'Demo Student', 'Demo@1234', 'USER');
  await upsertUser('admin@taskline.dev', 'Taskline Admin', 'Admin@1234', 'ADMIN');

  for (const project of projects) {
    await prisma.project.create({
      data: {
        userId: demo.id,
        name: project.name,
        description: project.description,
        status: project.status,
        startDate: dateFromToday(project.start),
        endDate: dateFromToday(project.end),
        tasks: {
          create: project.tasks.map(([name, priority, status, due, description]) => ({
            name,
            priority,
            status,
            description: description ?? null,
            dueDate: due === null ? null : dateFromToday(due),
            completedAt: status === 'COMPLETED' ? new Date() : null,
          })),
        },
      },
    });
  }

  const taskCount = projects.reduce((n, p) => n + p.tasks.length, 0);
  console.log(`Seeded ${projects.length} projects and ${taskCount} tasks for demo@taskline.dev`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
