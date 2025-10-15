exports.up = async function(knex) {
  const hasCol = await knex.schema.hasColumn('group_members', 'user_name');
  if (!hasCol) {
    await knex.schema.alterTable('group_members', function(table) {
      table.string('user_name').nullable();
    });
  }
};

exports.down = async function(knex) {
  const hasCol = await knex.schema.hasColumn('group_members', 'user_name');
  if (hasCol) {
    const client = knex.client.config.client;
    if (client === 'sqlite3') {
      await knex.transaction(async (trx) => {
        await trx.schema.createTable('_group_members_tmp', function (table) {
          table.string('group_id').notNullable();
          table.string('user_id').notNullable();
          table.timestamps(true, true);
          table.primary(['group_id', 'user_id']);
        });

        await trx.raw(`
          INSERT INTO _group_members_tmp (group_id, user_id, created_at, updated_at)
          SELECT group_id, user_id, created_at, updated_at FROM group_members
        `);

        await trx.schema.dropTable('group_members');
        await trx.schema.renameTable('_group_members_tmp', 'group_members');

        await trx.schema.alterTable('group_members', function (table) {
          table.foreign('group_id').references('id').inTable('groups').onDelete('CASCADE');
          table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
        });
      });
    } else {
      await knex.schema.alterTable('group_members', function(table) {
        table.dropColumn('user_name');
      });
    }
  }
};