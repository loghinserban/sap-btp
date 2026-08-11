const cds = require('@sap/cds');

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
        dateOfBirth: p.dob.date.slice(0, 10),
        experience: rand(15) + 1,
        department_ID: pick(depts).ID
      });

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

  srv.before('DELETE', 'Skills', async (req) => {
    const sSkillId = req.data.ID;

    const aUsed = await SELECT.from(EmployeeSkills)
      .columns('ID')
      .where({ skill_ID: sSkillId });

    if (aUsed.length > 0) {
      return req.reject(400, `Skill already attributed to  ${aUsed.length} employees . Delete it before`);
    }
  });

  srv.before('DELETE', 'Departments', async (req) => {
    const sDeptId = req.data.ID;

    const aUsed = await SELECT.from(Employees)
      .columns('ID')
      .where({ department_ID: sDeptId });

    if (aUsed.length > 0) {
      return req.reject(400, `Department has  ${aUsed.length} employees. Move them to another department first`);
    }
  });

  //reasignare si stergere departament

  srv.on('reassignDepartment', async (req) => {
    const { fromID, toID } = req.data;

    if (!fromID || !toID || fromID === toID) {
      return req.reject(400, 'Chose another department.');
    }

    await UPDATE(Employees).set({ department_ID: toID }).where({ department_ID: fromID });
    await DELETE.from(Departments).where({ ID: fromID });

    return 'Employees moves sucessfuly and department deleted';
  });

};