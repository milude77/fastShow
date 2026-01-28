
exports.up = function(knex) {
  return knex.schema.alterTable('users', table => {
    // GitHub 用户唯一 ID
    table
      .bigInteger('github_id')
      .unsigned()
      .unique()
      .comment('GitHub 用户 ID');

    // GitHub 用户名
    table
      .string('github_username', 100)
      .comment('GitHub 用户名');

    // 邮箱
    table
      .string('email', 255)
      .index()
      .comment('用户邮箱');
  });
}

/**
 * @param {import('knex').Knex} knex
 */
exports.down = function(knex) {
  return knex.schema.alterTable('user', table => {
    table.dropColumn('github_id');
    table.dropColumn('github_username');
    table.dropColumn('email');
  });
}
