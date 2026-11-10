/**
 * Jednotný formát akčního logu: { time, action, ...detail }.
 * Viz DegreeSequenceTask2 (add_edge, select_first_node, self_assessment_chosen, …).
 */
const createDigitoolActionLog = () => {
  const actionLogs = [];
  const logAction = (action, detail = {}) => {
    actionLogs.push({ time: Date.now(), action, ...detail });
  };
  return { actionLogs, logAction };
};
