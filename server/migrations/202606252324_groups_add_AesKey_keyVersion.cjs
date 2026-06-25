exports.up = async (knex) => {
    return await knex.schema.table('groups', (table) => {
        table.string('aes_key');
        table.integer('aes_version').defaultTo(0);
    });
};

exports.down = async (knex) => {
    return await knex.schema.table('groups', (table) => {
        table.dropColumn('aes_key');
        table.dropColumn('aes_version');
    });
};