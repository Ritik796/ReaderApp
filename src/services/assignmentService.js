import {getData, queryByChildEqualTo} from '../Firebase/dbServices';
const ASSIGNMENT_LOG = (...args) => console.log('[AssignmentService]', ...args);

async function getEmployeeName(empId) {
  if (!empId) return null;
  const name = await getData(`Employees/${empId}/GeneralDetails/name`);
  return name ? String(name) : null;
}

async function getWorkAssignmentForDevice(deviceName) {
  ASSIGNMENT_LOG('lookup:start', {deviceName});
  if (!deviceName) {
    throw new Error('Device name missing');
  }

  const matches = await queryByChildEqualTo('WorkAssignment', 'device', deviceName);
  ASSIGNMENT_LOG('lookup:raw_result', {deviceName, matches});
  if (!matches || typeof matches !== 'object') {
    throw new Error(`No assignment for device ${deviceName}`);
  }

  const [empId, assignment] = Object.entries(matches)[0] || [];
  if (!empId || !assignment) {
    throw new Error(`No assignment for device ${deviceName}`);
  }
  if (!assignment['current-assignment'] || !assignment.vehicle) {
    throw new Error('Incomplete assignment data');
  }

  const driverName = await getEmployeeName(empId);
  ASSIGNMENT_LOG('lookup:success', {
    empId,
    device: deviceName,
    vehicle: assignment.vehicle,
    currentAssignment: assignment['current-assignment'],
    driverName: driverName || null,
  });
  return {
    ...assignment,
    empId,
    helperId: empId,
    device: deviceName,
    userName: assignment.userName || driverName || '—',
    ward: assignment.ward || assignment['current-assignment'] || '—',
    driverName: driverName || '—',
  };
}

export {getWorkAssignmentForDevice, getEmployeeName};
