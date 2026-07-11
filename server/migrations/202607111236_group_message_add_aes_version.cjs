exports.up = async (knex) => {
    return await knex.schema.table('group_messages', (table) => {
        table.integer('aes_version').defaultTo(1);
    });
}

exports.down = async (knex) => {
    return await knex.schema.table('group_messages', (table) => {
        table.dropColumn('aes_version');
    });
}