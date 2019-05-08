import { Meteor } from 'meteor/meteor';
import { withTracker } from 'meteor/react-meteor-data';
import PropTypes from 'prop-types';
import {
    Container, Table, Menu, Button, Icon,
} from 'semantic-ui-react';
import React from 'react';
import ReactTable from 'react-table';
import { Link, browserHistory } from 'react-router';
import { PageMenu } from '../utils/Utils';

class UsersList extends React.Component {
    renderListItems = ({ users } = this.props) => users.map(user => (
        <Table.Row key={user._id}>
            <Table.Cell>
                <Link to={`/admin/user/${user._id}`}>{user.emails[0].address}</Link>
            </Table.Cell>
        </Table.Row>
    ));

    getColumns = () => [
        {
            Header: 'Last Name',
            id: 'lastname',
            accessor: 'profile.lastName',
            filterable: true,
            Cell: props => (
                <Link to={`/admin/user/${props.original._id}`}>{props.value}</Link>
            ),
        },
        {
            Header: 'First Name',
            id: 'firstname',
            accessor: 'profile.firstName',
            filterable: true,
            Cell: props => (
                <Link to={`/admin/user/${props.original._id}`}>{props.value}</Link>
            ),
        },
        {
            Header: 'Email',
            id: 'email',
            accessor: 'emails[0].address',
            filterable: true,
            Cell: props => (
                <Link to={`/admin/user/${props.original._id}`}>{props.value}</Link>
            ),
        },
        {
            id: 'edit',
            accessor: '_id',
            width: 55,
            Header: 'Edit',
            Cell: props => (
                <div className='center'>
                    <Link to={`/admin/user/${props.value}`}>
                        <Icon name='edit' color='grey' link size='small' />
                    </Link>
                </div>
            ),
        },
    ];


    render() {
        const { loading, users } = this.props;
        return (
            <div>
                <PageMenu title='Users' icon='users'>
                    <Menu.Menu position='right'>
                        <Menu.Item>
                            <Button
                                data-cy='new-user'
                                onClick={() => {
                                    browserHistory.push('/admin/user/add');
                                }}
                                primary
                                disabled={loading}
                                icon='add'
                                content='Add user'
                                labelPosition='left'
                            />
                        </Menu.Item>
                    </Menu.Menu>
                </PageMenu>
                <Container>
                    <ReactTable
                        data={users}
                        columns={this.getColumns()}
                        getTrProps={() => ({
                            style: {
                                height: '37px',
                                paddingLeft: '10px',
                            },
                        })}
                    />
                </Container>
            </div>
        );
    }
}

UsersList.propTypes = {
    // eslint-disable-next-line react/no-unused-prop-types
    users: PropTypes.array.isRequired,
    loading: PropTypes.bool.isRequired,
};

export default withTracker(() => {
    const usersHandle = Meteor.subscribe('userData');
    const users = Meteor.users.find({}).fetch();
    const loading = !usersHandle.ready();

    return {
        users: users || {},
        loading,
    };
})(UsersList);