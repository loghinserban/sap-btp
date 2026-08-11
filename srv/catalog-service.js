const cds = require ('@sap/cds');

module.exports = (srv) => {
  const { Employees, EmployeeSkills, Departments, Skills } = srv.entities;
  const rand = (n) => Math.floor(Math.random() * n);
  const pick = (a) => a[rand(a.length)];

  srv.on('seedDemoData', async (req) => {
    const count = Math.min(req.data.count || 25, 100);

    const res = await fetch(
      `https://randomuser.me/api/?results=${count}&inc=name,email,dob&nat=us,gb,de&noinfo`
    );
    const { results } = await res.json();

    // your CSVs are already loaded — just read them back
    const depts = await SELECT.from(Departments).columns('ID');
    const skills = await SELECT.from(Skills).columns('ID');

    const employees = [], empSkills = [];

    for (const p of results) {
      const ID = cds.utils.uuid();
      employees.push({
        ID,
        firstName: p.name.first,
        lastName: p.name.last,
        email: p.email,
        dateOfBirth: p.dob.date.slice(0, 10),   // ISO -> Date
        experience: rand(15) + 1,
        department_ID: pick(depts).ID
      });

      // 2-4 distinct skills per employee
      const some = [...skills].sort(() => Math.random() - 0.5).slice(0, 2 + rand(3));
      for (const s of some) {
        empSkills.push({
          ID: cds.utils.uuid(),
          employee_ID: ID,
          skill_ID: s.ID,
          rating: rand(5) + 1,
          lastUsed: new Date(Date.now() - rand(1000) * 864e5).toISOString().slice(0, 10)
        });
      }
    }

    await INSERT.into(Employees).entries(employees);
    await INSERT.into(EmployeeSkills).entries(empSkills);
    return `Inserted ${employees.length} employees`;
  });
};