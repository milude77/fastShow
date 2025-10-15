// Migration: add 'role' column to group_members with default 'member'
exports.up = async function(knex) {
  const hasCol = await knex.schema.hasColumn('group_members', 'role');
  if (!hasCol) {
    await knex.schema.alterTable('group_members', function(table) {
      table.string('role').notNullable().defaultTo('member'); // values: owner, admin, member
    });
  }
};

exports.down = async function(knex) {
  const hasCol = await knex.schema.hasColumn('group_members', 'role');
  if (hasCol) {
    const client = knex.client.config.client;
    if (client === 'sqlite3') {
      await knex.transaction(async (trx) => {
        const hasUserName = await trx.schema.hasColumn('group_members', 'user_name');

        await trx.schema.createTable('_group_members_tmp', function (table) {
          table.string('group_id').notNullable();
          table.string('user_id').notNullable();
          if (hasUserName) {
            table.string('user_name').notNullable();
          }
          table.timestamps(true, true);
          table.primary(['group_id', 'user_id']);
        });

        const cols = ['group_id','user_id'];
        if (hasUserName) cols.push('user_name');
        cols.push('created_at','updated_at');

        const insertSql = `INSERT INTO _group_members_tmp (${cols.join(', ')}) SELECT ${cols.join(', ')} FROM group_members`;
        await trx.raw(insertSql);

        await trx.schema.dropTable('group_members');
        await trx.schema.renameTable('_group_members_tmp', 'group_members');

        await trx.schema.alterTable('group_members', function (table) {
          table.foreign('group_id').references('id').inTable('groups').onDelete('CASCADE');
          table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
        });
      });
    } else {
      await knex.schema.alterTable('group_members', function(table) {
        table.dropColumn('role');
      });
    }
  }
};