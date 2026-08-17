const cds = require('@sap/cds');
const { extractCvProfile } = require('./cv-extract');
const { extractCvSkills } = require('./cv-skills');

function randomInt(max) {
  return Math.floor(Math.random() * max);
}

function randomPastDate() {
  const days = randomInt(1000);
  const date = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
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

module.exports = (srv) => {
  const { Employees, EmployeeSkills, Departments, Skills } = srv.entities;

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

    const departments = await SELECT.from(Departments).columns('ID');
    const skills = await SELECT.from(Skills).columns('ID');

    const employees = [];
    const employeeSkills = [];

    for (const person of people) {
      const employeeID = cds.utils.uuid();

      employees.push({
        ID: employeeID,
        firstName: person.name.first,
        lastName: person.name.last,
        email: person.email,
        dateOfBirth: person.dob.date.slice(0, 10),
        experience: randomInt(15) + 1,
        department_ID: departments[randomInt(departments.length)].ID
      });

      const howMany = 2 + randomInt(3);
      const chosen = [];

      while (chosen.length < howMany && chosen.length < skills.length) {
        const skill = skills[randomInt(skills.length)];
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
