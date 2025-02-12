// @ts-check

function extractInputSection(lines, title) {
  const index = lines.findIndex((line) => line.startsWith('###') && line.includes(title));
  if (index === -1) {
    return '';
  }
  return lines.splice(index, 4)[2].trim();
}

/**
 * @param {Object} params
 * @param {import("@actions/core")} params.core
 * @param {ReturnType<import("@actions/github").getOctokit>} params.github
 * @param {import("@actions/github").context} params.context
 */
module.exports = async ({ core, context, github }) => {
  try {
    const owner = context.repo.owner;
    const repo = context.repo.repo;

    const { issues } = await github.graphql(
      `
      query issues($owner: String!, $repo: String!, $num: Int = 50) {
        repository(owner: $owner, name: $repo) {
          issues(
            first: 50
            labels: ["support: premium standard"]
            states: OPEN
            orderBy: { field: UPDATED_AT, direction: DESC }
          ) {
            nodes {
              title
              url
              createdAt
              updatedAt
              author {
                login
              }
              comments (last:1) {
                totalCount
                nodes {
                  author {
                    __typename
                    login
                    ... on User {
                      organization(login: "mui") {
                        name
                      }
                    }
                  }
                  createdAt
                }
              }
            }
          }
        }
      }
    `,
      {
        owner,
        repo,
        num: 50,
      },
    );

    const filteredIssues = filteredIssues
      .map((issue) => {
        const updatedAt = new Date(issue.updatedAt);
        const age = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60); // age in hours
        return { ...issue, age };
      })
      .filter((issue) => {
        return !issue.comments.nodes.some((comment) => comment.author.organization?.name === 'MUI');
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    core.info(`>>> Found ${filteredIssues.length} issues`);

    const slaInfo = {
      info: [],
      warning: [],
      danger: [],
      breach: [],
    };

    filteredIssues.forEach((issue) => {
      if (issue.age < 4) {
        slaInfo.info.push(issue);
      } else if (issue.age >= 4 && issue.age < 16) {
        slaInfo.warning.push(issue);
      } else if (issue.age >= 16 && issue.age < 24) {
        slaInfo.danger.push(issue);
      } else if (issue.age >= 24) {
        slaInfo.breach.push(issue);
      }
    });

    core.info(`>>> SLA Info:`);
    core.info(`--- Info: ${slaInfo.info.length}`);
    core.info(`--- Warning: ${slaInfo.warning.length}`);
    core.info(`--- Danger: ${slaInfo.danger.length}`);
    core.info(`--- Breach: ${slaInfo.breach.length}`);

    core.setOutput('SLA_INFO', JSON.stringify(slaInfo));

    // const lines = issue.data.body.split('\n');
    //
    // // this is here to remove this section from the issue body
    // extractInputSection(lines, 'Latest version');
    //
    // const searchKeywords = extractInputSection(lines, 'Search keywords');
    // const products = extractInputSection(lines, 'Affected products');
    //
    // // get the order id and set it as an output for the support label step
    // let orderID = extractInputSection(lines, 'Order ID or Support key');
    // if (orderID === '_No response_') {
    //   orderID = '';
    // }
    //
    // // set the order id as an output (to be consumed by following workflows)
    // core.setOutput('ORDER_ID', orderID);
    //
    // // log all the values
    // core.info(`>>> Search Keywords: ${searchKeywords}`);
    // core.info(`>>> Order ID: ${orderID}`);
    // core.info(`>>> Affected Products: ${products}`);
    //
    // if (searchKeywords !== '') {
    //   lines.push('');
    //   lines.push(`**Search keywords**: ${searchKeywords}`);
    // }
    //
    // if (orderID !== '') {
    //   lines.push('');
    //   lines.push(`**Order ID**: ${orderID}`);
    // }
    //
    // const body = lines.join('\n');
    // core.info(`>>> Cleansed issue body: ${body}`);
    //
    // const labels = issue.data.labels.map((label) => label.name);
    //
    // if (products !== '') {
    //   products.split(',').forEach((product) => {
    //     if (productMap[product.trim()]) {
    //       labels.push(`component: ${productMap[product.trim()]}`);
    //     }
    //   });
    // }
    //
    // core.info(`>>> Labels: ${labels.join(',')}`);
    //
    // await github.rest.issues.update({
    //   owner: context.repo.owner,
    //   repo: context.repo.repo,
    //   issue_number: context.issue.number,
    //   title: issue.data.title,
    //   body,
    //   labels,
    // });
  } catch (error) {
    core.error(`>>> Workflow failed with: ${error.message}`);
    core.setFailed(error.message);
  }
};
