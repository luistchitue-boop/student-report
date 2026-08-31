const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const turmaNames = require('../turmas.json');

const prisma = new PrismaClient();

const targetTurmas = turmaNames.map((name) => ({ name }));

const firstNames = [
  'Ana', 'Bruno', 'Carlos', 'Daniela', 'Eduardo', 'Fernanda', 'Gabriel', 'Helena', 'Igor', 'Julia',
  'Kaio', 'Luan', 'Marina', 'Nicolas', 'Olivia', 'Pedro', 'Quezia', 'Rafael', 'Sofia', 'Tiago',
  'Uma', 'Vitor', 'Wesley', 'Ximena', 'Yasmin', 'Zeca', 'Alice', 'Benjamim', 'Camila', 'Davi',
  'Emilia', 'Felipe', 'Giovanna', 'Henrique', 'Isabela', 'Joao', 'Karla', 'Leonardo', 'Maya', 'Noah',
  'Patricia', 'Otavio', 'Rita', 'Samuel', 'Tatiana', 'Ulisses', 'Valentina', 'William', 'Yuri', 'Zora'
];

const lastNames = [
  'Almeida', 'Barros', 'Costa', 'Dias', 'Esteves', 'Ferreira', 'Gomes', 'Horta', 'Iglesias', 'Junior',
  'Klein', 'Lima', 'Matos', 'Nascimento', 'Oliveira', 'Pereira', 'Queiroz', 'Rocha', 'Silva', 'Teixeira',
  'Uchoa', 'Vieira', 'Wanderley', 'Xavier', 'Yamamoto', 'Zanetti', 'Araujo', 'Borges', 'Carvalho', 'Duarte',
  'Elias', 'Fonseca', 'Guerra', 'Hernandes', 'Inacio', 'Jardim', 'Lopes', 'Mendes', 'Nogueira', 'Paiva',
  'Quintana', 'Ribeiro', 'Santos', 'Tavares', 'Vargas', 'Wolff', 'Ximenes', 'Yoshida', 'Zamboni'
];

function randomItem(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function generateRandomName(existingNames) {
  let candidate = `${randomItem(firstNames)} ${randomItem(lastNames)}`;
  let attempts = 0;

  while (existingNames.has(candidate) && attempts < 50) {
    candidate = `${randomItem(firstNames)} ${randomItem(lastNames)}`;
    attempts += 1;
  }

  existingNames.add(candidate);
  return candidate;
}

async function ensureUserAndTeacher() {
  const email = 'test@example.com';
  const password = 'test1234';

  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        name: 'Test Coordinator',
        password: await bcrypt.hash(password, 10),
      },
    });
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: 'Test Coordinator',
        password: await bcrypt.hash(password, 10),
      },
    });
  }

  let teacher = await prisma.teacher.findUnique({ where: { userId: user.id } });
  if (!teacher) {
    teacher = await prisma.teacher.create({
      data: {
        userId: user.id,
        name: 'Test Coordinator',
        role: 'COORDENADOR',
      },
    });
  }

  return teacher;
}

async function seedTurmas(teacher) {
  const results = [];

  for (const turmaConfig of targetTurmas) {
    let turma = await prisma.turma.findFirst({ where: { name: turmaConfig.name } });

    if (!turma) {
      turma = await prisma.turma.create({
        data: {
          name: turmaConfig.name,
          coordinatorId: teacher.id,
          schedule: 'Segunda a Sexta',
        },
      });
    } else {
      turma = await prisma.turma.update({
        where: { id: turma.id },
        data: {
          coordinatorId: teacher.id,
          schedule: 'Segunda a Sexta',
        },
      });
    }

    const studentCount = await prisma.student.count({ where: { turmaId: turma.id } });
    results.push({
      name: turma.name,
      studentCount,
    });
  }

  return results;
}

async function main() {
  const teacher = await ensureUserAndTeacher();
  const results = await seedTurmas(teacher);

  console.log(JSON.stringify({
    email: 'test@example.com',
    password: 'test1234',
    teacherId: teacher.id,
    turmas: results,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
