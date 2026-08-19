const cds = require('@sap/cds');
const { extractCvProfile } = require('./cv-extract');
const { extractCvSkills } = require('./cv-skills');

const MS_PER_MONTH = 1000 * 60 * 60 * 24 * 30.44;
const AGING_MONTHS = 24;
const TOP_SKILLS_SHOWN = 6;
const RISKS_SHOWN = 8;

function randomInt(max) {
  return Math.floor(Math.random() * max);
}

function randomPastDate() {
  const days = randomInt(1000);
  const date = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

const departmentSkillPools = {
  'Engineering': ['JavaScript', 'TypeScript', 'SAP UI5', 'CAP', 'SAP Fiori Elements', 'SAP Business Application Studio', 'Core Data Services', 'OData', 'Node.js', 'Java', 'Spring Boot', 'Git', 'REST API Design', 'Microservices Architecture', 'ABAP RAP', 'ABAP Cloud'],
  'Sales': ['SAP S/4HANA', 'SAP Analytics Cloud', 'Agile and SAFe', 'Enterprise Architecture', 'SAP Ariba'],
  'HR': ['SAP SuccessFactors', 'Agile and SAFe', 'SQL', 'SAP Analytics Cloud'],
  'Finance': ['SAP S/4HANA', 'SAP Analytics Cloud', 'SQL', 'SAP Datasphere', 'SAP Ariba'],
  'Marketing': ['SAP Analytics Cloud', 'SQL', 'Agile and SAFe', 'JavaScript'],
  'SAP Basis and Operations': ['SAP BTP Administration', 'Cloud Foundry', 'MTA Deployment', 'SAP Cloud Transport Management', 'SAP Destination Service', 'SAP HANA Cloud', 'HANA', 'Kubernetes', 'Docker'],
  'Cloud Platform Engineering': ['SAP BTP Administration', 'Cloud Foundry', 'MTA Deployment', 'Kubernetes', 'Docker', 'Terraform', 'CI/CD Pipelines', 'Git', 'Microsoft Azure', 'SAP Business Application Studio'],
  'Integration': ['SAP Integration Suite', 'SAP Event Mesh', 'SAP Destination Service', 'OData', 'Apache Kafka', 'REST API Design', 'SAP Build Process Automation'],
  'Data and Analytics': ['SAP Datasphere', 'SAP Analytics Cloud', 'SAP HANA Cloud', 'HANA', 'PostgreSQL', 'SQL', 'Python', 'Apache Kafka'],
  'Quality Assurance': ['CI/CD Pipelines', 'Git', 'Python', 'JavaScript', 'TypeScript', 'REST API Design', 'Agile and SAFe'],
  'IT Security': ['XSUAA and Identity Services', 'OAuth 2.0 and SAML', 'SAP Destination Service', 'Kubernetes', 'Enterprise Architecture'],
  'Consulting': ['SAP S/4HANA', 'CAP', 'SAP UI5', 'SAP Integration Suite', 'Enterprise Architecture', 'Agile and SAFe', 'SAP Analytics Cloud', 'ABAP RAP']
};

function skillPoolFor(departmentName, skills) {
  const names = departmentSkillPools[departmentName];
  if (!names) {
    return skills;
  }

  const pool = [];
  for (const skill of skills) {
    if (names.indexOf(skill.name) !== -1) {
      pool.push(skill);
    }
  }

  if (pool.length < 4) {
    return skills;
  }
  return pool;
}

function clampRating(value) {
  let rating = parseInt(value, 10);
  if (!rating) {
    rating = 3;
  }
  if (rating < 1) {
    rating = 1;
  }
  if (rating > 5) {
    rating = 5;
  }
  return rating;
}

function asDate(value) {
  if (typeof value !== 'string') {
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  return value;
}

function findSkillById(catalog, id) {
  if (!id) {
    return null;
  }
  for (let i = 0; i < catalog.length; i++) {
    if (catalog[i].ID === id) {
      return catalog[i];
    }
  }
  return null;
}

function findSkillByName(catalog, name) {
  const wanted = name.trim().toLowerCase();
  for (let i = 0; i < catalog.length; i++) {
    const current = (catalog[i].name || '').trim().toLowerCase();
    if (current === wanted) {
      return catalog[i];
    }
  }
  return null;
}

function findRowBySkill(rows, skillID) {
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].skill_ID === skillID) {
      return rows[i];
    }
  }
  return null;
}

function findByID(rows, id) {
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].ID === id) {
      return rows[i];
    }
  }
  return null;
}

function asList(rows) {
  if (!rows) {
    return [];
  }
  if (Array.isArray(rows)) {
    return rows;
  }
  return [rows];
}

function countFor(rows, field, id) {
  let total = 0;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][field] === id) {
      total++;
    }
  }
  return total;
}

function monthsSince(value) {
  if (!value) {
    return null;
  }
  const then = new Date(value);
  if (isNaN(then.getTime())) {
    return null;
  }
  const months = Math.floor((Date.now() - then.getTime()) / MS_PER_MONTH);
  if (months < 0) {
    return 0;
  }
  return months;
}

function percent(value, total) {
  if (!total) {
    return 0;
  }
  return Math.round((value * 100) / total);
}

function average(sum, count) {
  if (!count) {
    return 0;
  }
  return Math.round((sum / count) * 10) / 10;
}

function byEmployeesDesc(a, b) {
  return b.employees - a.employees;
}

function bySeverityDesc(a, b) {
  if (b.weight !== a.weight) {
    return b.weight - a.weight;
  }
  return b.months - a.months;
}

module.exports = (srv) => {
  const { Employees, EmployeeSkills, Departments, Skills, Reviews } = srv.entities;

  srv.after('READ', 'Skills', async (rows) => {
    const list = asList(rows);
    if (list.length === 0) {
      return;
    }

    const used = await SELECT.from(EmployeeSkills).columns('skill_ID');

    for (let i = 0; i < list.length; i++) {
      if (list[i] && list[i].ID) {
        list[i].usageCount = countFor(used, 'skill_ID', list[i].ID);
      }
    }
  });

  srv.after('READ', 'Departments', async (rows) => {
    const list = asList(rows);
    if (list.length === 0) {
      return;
    }

    const used = await SELECT.from(Employees).columns('department_ID');

    for (let i = 0; i < list.length; i++) {
      if (list[i] && list[i].ID) {
        list[i].usageCount = countFor(used, 'department_ID', list[i].ID);
      }
    }
  });

  srv.before('CREATE', 'Skills', async (req) => {
    await rejectDuplicateName(req, Skills, 'skill');
  });

  srv.before('UPDATE', 'Skills', async (req) => {
    await rejectDuplicateName(req, Skills, 'skill');
  });

  srv.before('CREATE', 'Departments', async (req) => {
    await rejectDuplicateName(req, Departments, 'department');
  });

  srv.before('UPDATE', 'Departments', async (req) => {
    await rejectDuplicateName(req, Departments, 'department');
  });

  async function rejectDuplicateName(req, entity, label) {
    const name = req.data.name;
    if (!name) {
      return;
    }

    const ownID = keyOf(req);
    const existing = await SELECT.from(entity).columns('ID', 'name');
    const wanted = name.trim().toLowerCase();

    for (let i = 0; i < existing.length; i++) {
      const current = (existing[i].name || '').trim().toLowerCase();
      if (current === wanted && existing[i].ID !== ownID) {
        return req.reject(400, 'A ' + label + ' called "' + existing[i].name + '" already exists.');
      }
    }
  }

  function keyOf(req) {
    if (req.data && req.data.ID) {
      return req.data.ID;
    }
    if (!req.params || req.params.length === 0) {
      return null;
    }

    const last = req.params[req.params.length - 1];
    if (last && last.ID) {
      return last.ID;
    }
    return last;
  }

  srv.on('seedDemoData', async (req) => {
    let count = req.data.count;
    if (!count) {
      count = 25;
    }
    if (count > 100) {
      count = 100;
    }

    const url = 'https://randomuser.me/api/?results=' + count + '&inc=name,email,dob&nat=us,gb,de&noinfo';
    const response = await fetch(url);
    const body = await response.json();
    const people = body.results;

    const departments = await SELECT.from(Departments).columns('ID', 'name');
    const skills = await SELECT.from(Skills).columns('ID', 'name');

    const employees = [];
    const employeeSkills = [];

    for (const person of people) {
      const employeeID = cds.utils.uuid();
      const department = departments[randomInt(departments.length)];

      employees.push({
        ID: employeeID,
        firstName: person.name.first,
        lastName: person.name.last,
        email: person.email,
        dateOfBirth: person.dob.date.slice(0, 10),
        experience: randomInt(15) + 1,
        department_ID: department.ID
      });

      const pool = skillPoolFor(department.name, skills);
      const howMany = 4 + randomInt(4);
      const chosen = [];

      while (chosen.length < howMany && chosen.length < pool.length) {
        const skill = pool[randomInt(pool.length)];
        if (chosen.indexOf(skill.ID) !== -1) {
          continue;
        }
        chosen.push(skill.ID);

        employeeSkills.push({
          ID: cds.utils.uuid(),
          employee_ID: employeeID,
          skill_ID: skill.ID,
          rating: randomInt(5) + 1,
          lastUsed: randomPastDate()
        });
      }

      if (randomInt(3) === 0) {
        const extra = skills[randomInt(skills.length)];
        if (chosen.indexOf(extra.ID) === -1) {
          employeeSkills.push({
            ID: cds.utils.uuid(),
            employee_ID: employeeID,
            skill_ID: extra.ID,
            rating: randomInt(5) + 1,
            lastUsed: randomPastDate()
          });
        }
      }
    }

    await INSERT.into(Employees).entries(employees);
    await INSERT.into(EmployeeSkills).entries(employeeSkills);

    return 'Inserted ' + employees.length + ' employees';
  });

  srv.before('DELETE', 'Skills', async (req) => {
    const used = await SELECT.from(EmployeeSkills).columns('ID').where({ skill_ID: req.data.ID });

    if (used.length > 0) {
      return req.reject(400, 'This skill is assigned to ' + used.length + ' employees. Remove it from them first.');
    }
  });

  srv.before('DELETE', 'Departments', async (req) => {
    const used = await SELECT.from(Employees).columns('ID').where({ department_ID: req.data.ID });

    if (used.length > 0) {
      return req.reject(400, 'This department has ' + used.length + ' employees. Move them to another department first.');
    }
  });

  srv.on('reassignDepartment', async (req) => {
    const fromID = req.data.fromID;
    const toID = req.data.toID;

    if (!fromID || !toID || fromID === toID) {
      return req.reject(400, 'Choose another department.');
    }

    await UPDATE(Employees).set({ department_ID: toID }).where({ department_ID: fromID });
    await DELETE.from(Departments).where({ ID: fromID });

    return 'Employees moved successfully and department deleted';
  });

  srv.on('mergeSkills', async (req) => {
    const fromID = req.data.fromID;
    const toID = req.data.toID;

    if (!fromID || !toID || fromID === toID) {
      return req.reject(400, 'Choose two different skills.');
    }

    const source = await SELECT.one.from(Skills).columns('ID', 'name').where({ ID: fromID });
    const target = await SELECT.one.from(Skills).columns('ID', 'name').where({ ID: toID });

    if (!source || !target) {
      return req.reject(404, 'Skill not found.');
    }

    const sourceRows = await SELECT.from(EmployeeSkills).where({ skill_ID: fromID });
    const targetRows = await SELECT.from(EmployeeSkills).where({ skill_ID: toID });

    let moved = 0;
    let merged = 0;

    for (let i = 0; i < sourceRows.length; i++) {
      const row = sourceRows[i];
      let twin = null;

      for (let j = 0; j < targetRows.length; j++) {
        if (targetRows[j].employee_ID === row.employee_ID) {
          twin = targetRows[j];
        }
      }

      if (!twin) {
        await UPDATE(EmployeeSkills).set({ skill_ID: toID }).where({ ID: row.ID });
        moved++;
        continue;
      }

      let rating = twin.rating;
      if (row.rating > rating) {
        rating = row.rating;
      }

      let lastUsed = twin.lastUsed;
      if (row.lastUsed && (!lastUsed || row.lastUsed > lastUsed)) {
        lastUsed = row.lastUsed;
      }

      await UPDATE(EmployeeSkills).set({ rating: rating, lastUsed: lastUsed }).where({ ID: twin.ID });
      await DELETE.from(EmployeeSkills).where({ ID: row.ID });
      merged++;
    }

    await DELETE.from(Skills).where({ ID: fromID });

    return source.name + ' merged into ' + target.name + '. ' + moved + ' moved, ' + merged + ' already existed.';
  });

  srv.on('getDashboard', async () => {
    const employees = await SELECT.from(Employees).columns('ID', 'firstName', 'lastName', 'experience', 'department_ID');
    const departments = await SELECT.from(Departments).columns('ID', 'name');
    const skills = await SELECT.from(Skills).columns('ID', 'name');
    const assignments = await SELECT.from(EmployeeSkills).columns('employee_ID', 'skill_ID', 'rating', 'lastUsed');
    const reviews = await SELECT.from(Reviews).columns('stars');

    const skillStats = [];
    for (let i = 0; i < skills.length; i++) {
      skillStats.push({
        ID: skills[i].ID,
        name: skills[i].name,
        employees: 0,
        ratingSum: 0,
        newestMonths: null,
        onlyExpertID: null
      });
    }

    const departmentStats = [];
    for (let i = 0; i < departments.length; i++) {
      departmentStats.push({
        ID: departments[i].ID,
        name: departments[i].name,
        employees: 0,
        experienceSum: 0,
        skillIDs: []
      });
    }

    const employeesWithSkills = [];
    let ratingSum = 0;

    for (let i = 0; i < assignments.length; i++) {
      const row = assignments[i];
      const stat = findByID(skillStats, row.skill_ID);
      const months = monthsSince(row.lastUsed);

      if (stat) {
        stat.employees++;
        stat.ratingSum = stat.ratingSum + (row.rating || 0);
        stat.onlyExpertID = row.employee_ID;

        if (months !== null && (stat.newestMonths === null || months < stat.newestMonths)) {
          stat.newestMonths = months;
        }
      }

      ratingSum = ratingSum + (row.rating || 0);

      if (employeesWithSkills.indexOf(row.employee_ID) === -1) {
        employeesWithSkills.push(row.employee_ID);
      }

      const employee = findByID(employees, row.employee_ID);
      if (employee) {
        const department = findByID(departmentStats, employee.department_ID);
        if (department && department.skillIDs.indexOf(row.skill_ID) === -1) {
          department.skillIDs.push(row.skill_ID);
        }
      }
    }

    for (let i = 0; i < employees.length; i++) {
      const department = findByID(departmentStats, employees[i].department_ID);
      if (department) {
        department.employees++;
        department.experienceSum = department.experienceSum + (employees[i].experience || 0);
      }
    }

    let unusedSkills = 0;
    let singleExpertSkills = 0;

    for (let i = 0; i < skillStats.length; i++) {
      if (skillStats[i].employees === 0) {
        unusedSkills++;
      }
      if (skillStats[i].employees === 1) {
        singleExpertSkills++;
      }
    }

    let starsSum = 0;
    for (let i = 0; i < reviews.length; i++) {
      starsSum = starsSum + (reviews[i].stars || 0);
    }

    const kpis = {
      employees: employees.length,
      departments: departments.length,
      skills: skills.length,
      assignments: assignments.length,
      avgSkillsPerEmployee: average(assignments.length, employees.length),
      avgRating: average(ratingSum, assignments.length),
      employeesWithoutSkills: employees.length - employeesWithSkills.length,
      unusedSkills: unusedSkills,
      singleExpertSkills: singleExpertSkills
    };

    const ranked = skillStats.slice();
    ranked.sort(byEmployeesDesc);

    const topSkills = [];
    for (let i = 0; i < ranked.length && i < TOP_SKILLS_SHOWN; i++) {
      topSkills.push({
        ID: ranked[i].ID,
        name: ranked[i].name,
        employees: ranked[i].employees,
        share: percent(ranked[i].employees, employees.length),
        avgRating: average(ranked[i].ratingSum, ranked[i].employees)
      });
    }

    const departmentLoad = [];
    for (let i = 0; i < departmentStats.length; i++) {
      departmentLoad.push({
        ID: departmentStats[i].ID,
        name: departmentStats[i].name,
        employees: departmentStats[i].employees,
        share: percent(departmentStats[i].employees, employees.length),
        skills: departmentStats[i].skillIDs.length,
        avgExperience: average(departmentStats[i].experienceSum, departmentStats[i].employees)
      });
    }
    departmentLoad.sort(byEmployeesDesc);

    const risks = [];
    for (let i = 0; i < skillStats.length; i++) {
      const stat = skillStats[i];
      const months = stat.newestMonths;

      let reason = null;
      let weight = 0;

      if (stat.employees === 0) {
        reason = 'Nobody has this skill';
        weight = 2;
      } else if (stat.employees === 1 && (months === null || months > AGING_MONTHS)) {
        reason = 'Only one expert, and out of practice';
        weight = 4;
      } else if (stat.employees === 1) {
        reason = 'Only one expert';
        weight = 3;
      } else if (months === null || months > AGING_MONTHS) {
        reason = 'Nobody used it recently';
        weight = 1;
      }

      if (!reason) {
        continue;
      }

      let expert = '';
      if (stat.employees === 1) {
        const person = findByID(employees, stat.onlyExpertID);
        if (person) {
          expert = person.firstName + ' ' + person.lastName;
        }
      }

      let shownMonths = months;
      if (shownMonths === null) {
        shownMonths = 0;
      }

      risks.push({
        ID: stat.ID,
        name: stat.name,
        employees: stat.employees,
        expert: expert,
        months: shownMonths,
        reason: reason,
        weight: weight
      });
    }

    risks.sort(bySeverityDesc);

    const shownRisks = [];
    for (let i = 0; i < risks.length && i < RISKS_SHOWN; i++) {
      shownRisks.push({
        ID: risks[i].ID,
        name: risks[i].name,
        employees: risks[i].employees,
        expert: risks[i].expert,
        months: risks[i].months,
        reason: risks[i].reason
      });
    }

    return {
      kpis: kpis,
      topSkills: topSkills,
      departments: departmentLoad,
      risks: shownRisks
    };
  });

  srv.on('extractCv', async (req) => {
    if (!req.data.contentBase64) {
      return req.error(400, 'No file content received.');
    }

    const catalog = await SELECT.from(Skills).columns('ID', 'name').orderBy('name');

    let profile;
    try {
      profile = await extractCvProfile({ contentBase64: req.data.contentBase64, catalog });
    } catch (err) {
      console.error('CV extraction failed:', err);
      return req.error(500, 'CV extraction failed: ' + err.message);
    }

    const skills = profile.skills || [];
    for (const skill of skills) {
      if (!findSkillById(catalog, skill.skillID)) {
        skill.skillID = null;
      }
    }
    profile.skills = skills;

    return profile;
  });

  srv.on('extractCvSkills', async (req) => {
    if (!req.data.contentBase64) {
      return req.error(400, 'No file content received.');
    }

    const catalog = await SELECT.from(Skills).columns('ID', 'name').orderBy('name');

    let found;
    try {
      found = await extractCvSkills({
        fileName: req.data.fileName,
        contentBase64: req.data.contentBase64,
        catalog
      });
    } catch (err) {
      console.error('CV skill extraction failed:', err);
      return req.error(500, 'CV skill extraction failed: ' + err.message);
    }

    const result = [];
    const usedNames = [];

    for (const skill of found) {
      const name = (skill.name || '').trim();
      if (!name) {
        continue;
      }

      const lowerName = name.toLowerCase();
      if (usedNames.indexOf(lowerName) !== -1) {
        continue;
      }
      usedNames.push(lowerName);

      let match = findSkillById(catalog, skill.skillID);
      if (!match) {
        match = findSkillByName(catalog, name);
      }

      result.push({
        skillID: match ? match.ID : null,
        name: match ? match.name : name,
        rating: clampRating(skill.rating),
        lastUsed: asDate(skill.lastUsed),
        evidence: (skill.evidence || '').slice(0, 255)
      });
    }

    return result;
  });

  srv.on('applyCvSkills', async (req) => {
    const employeeID = req.data.employeeID;
    const skills = req.data.skills;

    if (!employeeID) {
      return req.error(400, 'Employee ID is required.');
    }
    if (!skills || skills.length === 0) {
      return req.error(400, 'No skills to import.');
    }

    const employee = await SELECT.one.from(Employees).columns('ID').where({ ID: employeeID });
    if (!employee) {
      return req.error(404, 'Employee ' + employeeID + ' not found.');
    }

    const catalog = await SELECT.from(Skills).columns('ID', 'name');
    const existingRows = await SELECT.from(EmployeeSkills).columns('ID', 'skill_ID').where({ employee_ID: employeeID });

    let added = 0;
    let updated = 0;
    let createdSkills = 0;
    const handled = [];

    for (const skill of skills) {
      const name = (skill.name || '').trim();
      if (!name) {
        continue;
      }

      let match = findSkillById(catalog, skill.skillID);
      if (!match) {
        match = findSkillByName(catalog, name);
      }

      let skillID;
      if (match) {
        skillID = match.ID;
      } else {
        skillID = cds.utils.uuid();
        await INSERT.into(Skills).entries({ ID: skillID, name: name });
        catalog.push({ ID: skillID, name: name });
        createdSkills++;
      }

      if (handled.indexOf(skillID) !== -1) {
        continue;
      }
      handled.push(skillID);

      const rating = clampRating(skill.rating);
      const lastUsed = asDate(skill.lastUsed);
      const existingRow = findRowBySkill(existingRows, skillID);

      if (existingRow) {
        if (lastUsed) {
          await UPDATE(EmployeeSkills).set({ rating: rating, lastUsed: lastUsed }).where({ ID: existingRow.ID });
        } else {
          await UPDATE(EmployeeSkills).set({ rating: rating }).where({ ID: existingRow.ID });
        }
        updated++;
      } else {
        await INSERT.into(EmployeeSkills).entries({
          ID: cds.utils.uuid(),
          employee_ID: employeeID,
          skill_ID: skillID,
          rating: rating,
          lastUsed: lastUsed
        });
        added++;
      }
    }

    return {
      added: added,
      updated: updated,
      createdSkills: createdSkills,
      message: added + ' skill(s) added, ' + updated + ' updated, ' + createdSkills + ' new to the catalog.'
    };
  });

  srv.on('createEmployeeFromCv', async (req) => {
    const profile = req.data.profile;
    const departmentID = req.data.departmentID;

    if (!profile || !profile.firstName || !profile.lastName) {
      return req.error(400, 'First and last name are required.');
    }

    const employeeID = cds.utils.uuid();
    const catalog = await SELECT.from(Skills).columns('ID', 'name');
    const profileSkills = profile.skills || [];

    const newSkills = [];
    const rows = [];
    const handled = [];

    for (const skill of profileSkills) {
      let skillID;
      let match = findSkillById(catalog, skill.skillID);

      if (match) {
        skillID = match.ID;
      } else {
        const name = (skill.name || '').trim();
        if (!name) {
          continue;
        }

        match = findSkillByName(catalog, name);
        if (match) {
          skillID = match.ID;
        } else {
          skillID = cds.utils.uuid();
          catalog.push({ ID: skillID, name: name });
          newSkills.push({ ID: skillID, name: name });
        }
      }

      if (handled.indexOf(skillID) !== -1) {
        continue;
      }
      handled.push(skillID);

      rows.push({
        ID: cds.utils.uuid(),
        employee_ID: employeeID,
        skill_ID: skillID,
        rating: clampRating(skill.rating),
        lastUsed: asDate(skill.lastUsed)
      });
    }

    if (newSkills.length > 0) {
      await INSERT.into(Skills).entries(newSkills);
    }

    await INSERT.into(Employees).entries({
      ID: employeeID,
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: profile.email,
      experience: profile.experience,
      department_ID: departmentID || null
    });

    if (rows.length > 0) {
      await INSERT.into(EmployeeSkills).entries(rows);
    }

    let message = profile.firstName + ' ' + profile.lastName + ' created with ' + rows.length + ' skills.';
    if (newSkills.length > 0) {
      message = message + ' ' + newSkills.length + ' new skills added to the catalog.';
    }

    return message;
  });
};
