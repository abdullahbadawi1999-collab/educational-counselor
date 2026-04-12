const { sql } = require('./connection');
const fs = require('fs');
const path = require('path');
const seedData = require('./seed-data.json');

async function seed() {
  console.log('Running schema...');
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  // Execute each statement separately
  const statements = schema.split(';').map(s => s.trim()).filter(s => s.length > 0);
  for (const stmt of statements) {
    await sql(stmt);
  }
  console.log('Schema created.');

  // Check if already seeded
  const existing = await sql`SELECT COUNT(*) as count FROM circles`;
  if (existing[0].count > 0) {
    console.log('Database already seeded. Skipping...');
    return;
  }

  // Insert circles
  for (const circle of seedData.circles) {
    await sql`INSERT INTO circles (name, teacher_name) VALUES (${circle.name}, ${circle.teacher})`;
  }
  console.log(`Inserted ${seedData.circles.length} circles`);

  // Get circle ID map
  const circleRows = await sql`SELECT id, name FROM circles`;
  const circleMap = {};
  for (const row of circleRows) {
    circleMap[row.name] = row.id;
  }

  // Insert students
  let studentCount = 0;
  for (const student of seedData.students) {
    const circleId = circleMap[student.circle];
    if (!circleId) {
      console.warn(`Circle not found: ${student.circle} for student: ${student.name}`);
      continue;
    }
    await sql`INSERT INTO students (name, circle_id, student_phone, parent_phone_1, parent_phone_2)
      VALUES (${student.name}, ${circleId}, ${student.student_phone || null}, ${student.parent_phone_1 || null}, ${student.parent_phone_2 || null})`;
    studentCount++;
  }
  console.log(`Inserted ${studentCount} students`);

  // Insert behavior types
  for (const bt of seedData.behaviorTypes) {
    await sql`INSERT INTO behavior_types (name, type, category, severity, escalation_rule)
      VALUES (${bt.name}, ${bt.type}, ${bt.category || 'other'}, ${bt.severity || 'low'}, ${bt.escalation_rule || null})`;
  }
  console.log(`Inserted ${seedData.behaviorTypes.length} behavior types`);

  console.log('Database seeded successfully!');
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
