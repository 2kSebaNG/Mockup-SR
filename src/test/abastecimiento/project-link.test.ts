import { withProject } from '@/lib/abastecimiento/project-link';

describe('withProject', () => {
  it('appends the project when there is one', () => {
    expect(withProject('/procurement/payroll', 'p1')).toBe('/procurement/payroll?projectId=p1');
  });

  it('leaves the link alone without a project', () => {
    expect(withProject('/procurement/payroll', '')).toBe('/procurement/payroll');
  });
});
