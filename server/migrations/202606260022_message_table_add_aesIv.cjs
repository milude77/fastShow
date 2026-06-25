exports.up = async (knex) => {
    await knex.schema.table('messages', (table) => {
        table.text('aes_iv', 64);
    });

    await knex.schema.table('group_messages', (table) => {
        table.text('aes_iv', 64);
    });
}

exports.down = async (knex) => {
    await knex.schema.table('messages', (table) => {
        table.dropColumn('aes_iv');
    });

    await knex.schema.table('group_messages', (table) => {
        table.dropColumn('aes_iv');
    });
}