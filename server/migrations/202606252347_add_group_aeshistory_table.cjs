exports.up = async (knex) => {
    return knex.schema.createTable('group_aes_history', (table) => {
        table.increments('id').primary();
        table.string('group_id').notNullable();
        table.text('aes_key').notNullable();
        table.integer('aes_version').notNullable();
        table.timestamps();
    });
};

exports.down = async (knex) => {
    return knex.schema.dropTable('group_aes_history');
};
