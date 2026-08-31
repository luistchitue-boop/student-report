const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const turmaNames = require('../turmas.json');

const prisma = new PrismaClient();

const turmasDataDirectory = path.join(__dirname, '..', 'turmas');
const csvTurmaNames = fs.readdirSync(turmasDataDirectory)
  .filter((fileName) => fileName.endsWith('.csv'))
  .map((fileName) => path.basename(fileName, '.csv'));
const targetTurmas = [...new Set([...turmaNames, ...csvTurmaNames])].map((name) => ({ name }));

function parseCsvLine(line) {
  const values = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"' && quoted && nextCharacter === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      values.push(value.trim());
      value = '';
    } else {
      value += character;
    }
  }

  values.push(value.trim());
  return values;
}

function readTurmaCsv(turmaName) {
  const filePath = path.join(turmasDataDirectory, `${turmaName}.csv`);
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines.shift()).map((header) => header.toLowerCase());
  const columnIndex = (...names) => names.reduce((foundIndex, name) => (
    foundIndex >= 0 ? foundIndex : headers.indexOf(name.toLowerCase())
  ), -1);
  const guardianIndex = columnIndex('nome do encarregado', 'nome encarregado');
  const emailIndex = columnIndex('e-mail', 'email');
  const phoneIndex = columnIndex('telefone', 'telemovel', 'telefone do encarregado');
  const studentIndex = columnIndex('aluno', 'nome do aluno');
  const valueAt = (values, index) => (index >= 0 ? values[index] || '' : '');

  return lines.map((line) => {
    const values = parseCsvLine(line);
    return {
      parentName: valueAt(values, guardianIndex),
      email: valueAt(values, emailIndex).toUpperCase() === 'N/A' ? '' : valueAt(values, emailIndex),
      phone: valueAt(values, phoneIndex),
      studentName: valueAt(values, studentIndex),
    };
  });
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

    const rows = readTurmaCsv(turma.name);
    const studentRows = new Map();
    for (const row of rows) {
      if (!row.studentName) continue;
      if (!studentRows.has(row.studentName)) studentRows.set(row.studentName, []);
      studentRows.get(row.studentName).push(row);
    }

    const existingStudents = await prisma.student.findMany({
      where: { turmaId: turma.id },
      include: { parents: true },
    });
    const existingStudentNames = new Set(existingStudents.map((student) => student.name));
    const missingStudentNames = [...studentRows.keys()].filter((name) => !existingStudentNames.has(name));

    if (missingStudentNames.length > 0) {
      await prisma.student.createMany({
        data: missingStudentNames.map((name) => ({ turmaId: turma.id, name })),
      });
    }

    const students = await prisma.student.findMany({
      where: { turmaId: turma.id, name: { in: [...studentRows.keys()] } },
      include: { parents: true },
    });
    const studentsByName = new Map(students.map((student) => [student.name, student]));
    const parentData = [];

    for (const [studentName, studentParentRows] of studentRows) {
      const student = studentsByName.get(studentName);
      const existingParentKeys = new Set(
        student.parents.map((parent) => `${parent.name}\u0000${parent.phone}\u0000${parent.email}`)
      );

      for (const row of studentParentRows) {
        const key = `${row.parentName}\u0000${row.phone}\u0000${row.email}`;
        if (!existingParentKeys.has(key)) {
          existingParentKeys.add(key);
          parentData.push({
            studentId: student.id,
            name: row.parentName,
            phone: row.phone,
            email: row.email,
          });
        }
      }
    }

    if (parentData.length > 0) {
      await prisma.parent.createMany({ data: parentData });
    }

    results.push({
      name: turma.name,
      studentCount: students.length,
      parentCount: students.reduce((count, student) => count + student.parents.length, 0) + parentData.length,
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
