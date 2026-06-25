exports.up = async (knex) => {
    return knex.schema.alterTable('friends', (table) => {
        table.text('aes_key');
    });
};

exports.down = async (knex) => {
    return knex.schema.alterTable('friends', (table) => {
        table.dropColumn('aes_key');
    });
};