const cds = require('@sap/cds');


const { extractCvProfile } = require('./cv-extract');
const { extractCvSkills } = require('./cv-skills');

const clampRating = (n) => Math.min(5, Math.max(1, parseInt(n, 10) || 3));

// Accept only a plain calendar day; anything else becomes null rather than a
// value the Date column would reject.
const asDate = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

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

  srv.on('extractCv', async (req) => {
    const { contentBase64 } = req.data;
    if (!contentBase64) return req.error(400, 'No file content received.');

    const catalog = await SELECT.from(Skills).columns('ID', 'name').orderBy('name');

    try {
      const profile = await extractCvProfile({ contentBase64, catalog });

      const validIDs = new Set(catalog.map((s) => s.ID));
      profile.skills = (profile.skills || []).map((s) => ({
        ...s,
        skillID: validIDs.has(s.skillID) ? s.skillID : null
      }));

      return profile;
    } catch (e) {
      console.error('CV extraction failed:', e);
      return req.error(500, `CV extraction failed: ${e.message}`);
    }
  });

  // Self-service: read the CV and hand back the skills for the user to confirm.
  // Nothing is written here - applyCvSkills does that.
  srv.on('extractCvSkills', async (req) => {
    const { fileName, contentBase64 } = req.data;
    if (!contentBase64) return req.error(400, 'No file content received.');

    const catalog = await SELECT.from(Skills).columns('ID', 'name').orderBy('name');
    const byName = new Map(catalog.map((s) => [(s.name || '').toLowerCase(), s]));
    const validIDs = new Set(catalog.map((s) => s.ID));

    let skills;
    try {
      skills = await extractCvSkills({ fileName, contentBase64, catalog });
    } catch (e) {
      console.error('CV skill extraction failed:', e);
      return req.error(500, `CV skill extraction failed: ${e.message}`);
    }

    const seen = new Set();
    return skills.reduce((acc, s) => {
      const name = (s.name || '').trim();
      const key = name.toLowerCase();
      if (!name || seen.has(key)) return acc;
      seen.add(key);

      // Trust the model's ID only if it really exists; otherwise fall back to a
      // name match so a rephrased catalog skill is not imported as a duplicate.
      const skillID = validIDs.has(s.skillID) ? s.skillID : (byName.get(key)?.ID || null);

      acc.push({
        skillID,
        name: skillID ? (byName.get(key)?.name || name) : name,
        rating: clampRating(s.rating),
        lastUsed: asDate(s.lastUsed),
        evidence: (s.evidence || '').slice(0, 255)
      });
      return acc;
    }, []);
  });

  // Applies the confirmed skills to one employee: catalog skills are reused,
  // unknown ones are added to the catalog, and an existing pairing is re-rated
  // instead of duplicated.
  srv.on('applyCvSkills', async (req) => {
    const { employeeID, skills } = req.data;

    if (!employeeID) return req.error(400, 'Employee ID is required.');
    if (!skills?.length) return req.error(400, 'No skills to import.');

    const employee = await SELECT.one.from(Employees).columns('ID').where({ ID: employeeID });
    if (!employee) return req.error(404, `Employee ${employeeID} not found.`);

    const catalog = await SELECT.from(Skills).columns('ID', 'name');
    const byName = new Map(catalog.map((s) => [(s.name || '').toLowerCase(), s.ID]));
    const validIDs = new Set(catalog.map((s) => s.ID));

    const existing = await SELECT.from(EmployeeSkills)
      .columns('ID', 'skill_ID')
      .where({ employee_ID: employeeID });
    const existingBySkill = new Map(existing.map((r) => [r.skill_ID, r.ID]));

    let added = 0, updated = 0, createdSkills = 0;
    const handled = new Set();

    for (const s of skills) {
      const name = (s.name || '').trim();
      if (!name) continue;

      let skillID = validIDs.has(s.skillID) ? s.skillID : byName.get(name.toLowerCase());

      if (!skillID) {
        skillID = cds.utils.uuid();
        await INSERT.into(Skills).entries({ ID: skillID, name });
        byName.set(name.toLowerCase(), skillID);
        validIDs.add(skillID);
        createdSkills++;
      }

      // Two CV lines can resolve to the same catalog skill; keep the first.
      if (handled.has(skillID)) continue;
      handled.add(skillID);

      const rating = clampRating(s.rating);
      const lastUsed = asDate(s.lastUsed);
      const existingID = existingBySkill.get(skillID);

      if (existingID) {
        // A CV often gives no date for a skill - keep the stored one rather than
        // clearing it.
        await UPDATE(EmployeeSkills)
          .set(lastUsed ? { rating, lastUsed } : { rating })
          .where({ ID: existingID });
        updated++;
      } else {
        await INSERT.into(EmployeeSkills).entries({
          ID: cds.utils.uuid(),
          employee_ID: employeeID,
          skill_ID: skillID,
          rating,
          lastUsed
        });
        added++;
      }
    }

    return {
      added,
      updated,
      createdSkills,
      message: `${added} skill(s) added, ${updated} updated, ${createdSkills} new to the catalog.`
    };
  });

  srv.on('createEmployeeFromCv', async (req) => {
    const { profile, departmentID } = req.data;

    if (!profile?.firstName || !profile?.lastName) {
      return req.error(400, 'First and last name are required.');
    }

    const ID = cds.utils.uuid();

    // Skills the extraction could not match arrive with skillID null. Resolve them
    // by name against the catalog, and add the ones that are genuinely new.
    const catalog = await SELECT.from(Skills).columns('ID', 'name');
    const validIDs = new Set(catalog.map((s) => s.ID));
    const byName = new Map(catalog.map((s) => [s.name.trim().toLowerCase(), s.ID]));

    const newSkills = [];
    const seen = new Set();
    const rows = [];

    for (const s of profile.skills || []) {
      let skillID = validIDs.has(s.skillID) ? s.skillID : null;

      if (!skillID) {
        const name = (s.name || '').trim();
        if (!name) continue;

        skillID = byName.get(name.toLowerCase());
        if (!skillID) {
          skillID = cds.utils.uuid();
          byName.set(name.toLowerCase(), skillID);
          newSkills.push({ ID: skillID, name });
        }
      }

      if (seen.has(skillID)) continue; // same skill twice in one CV
      seen.add(skillID);

      rows.push({
        ID: cds.utils.uuid(),
        employee_ID: ID,
        skill_ID: skillID,
        rating: clampRating(s.rating),
        lastUsed: asDate(s.lastUsed)
      });
    }

    if (newSkills.length) await INSERT.into(Skills).entries(newSkills);

    await INSERT.into(Employees).entries({
      ID,
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: profile.email,
      experience: profile.experience,
      department_ID: departmentID || null
    });

    if (rows.length) await INSERT.into(EmployeeSkills).entries(rows);

    const added = newSkills.length ? ` ${newSkills.length} new skills added to the catalog.` : '';
    return `${profile.firstName} ${profile.lastName} created with ${rows.length} skills.${added}`;
  });
};